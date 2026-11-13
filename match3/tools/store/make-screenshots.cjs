/**
 * Google Play screenshots of «Zumurud», made from the REAL running game.
 *
 *   node tools/store/make-screenshots.cjs                 capture everything, lay out every upload file
 *   node tools/store/make-screenshots.cjs --layout        only lay out again from the captures on disk
 *                                                         (after a caption or layout change; no game needed)
 *   node tools/store/make-screenshots.cjs en phone        only these languages / device classes
 *   node tools/store/make-screenshots.cjs combo win       only these scenes (ids in shots-config.cjs)
 *   node tools/store/make-screenshots.cjs --frames        also keep every frame of the effect bursts in
 *                                                         node_modules/.cache/store-shots/ (to look at them)
 *
 * It writes, under store/screenshots/:
 *   raw/<lang>/NN-….png                 the captures themselves, phone, exactly 1080×1920
 *   raw/tablet7|tablet10/<lang>/….png   the captures at tablet layout, 1200×1920 and 1600×2560
 *   phone|tablet7|tablet10/<lang>/01-….png … 08-….png     the files to upload
 *   contact-<lang>.png                  every upload file side by side
 *   manifest.json, MANIFEST.md          for every file: level, language, seed, moves, moment — the audit trail
 *
 * How a capture is made (and what is never done): tools/store/game.cjs. How an upload file is laid
 * out: tools/store/compose.cjs. What is captured, the captions and the layout numbers:
 * tools/store/shots-config.cjs. Afterwards: node tools/store/check-kit.cjs screenshots
 *
 * The dev server of the game is started on port 5189 (STORE_PORT) without hot reload and stopped at
 * the end; a server already running there is reused. Playwright is the globally installed one.
 */
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT, STORE_PORT, startServer, toOpaqueRgbPng, decodePng, encodeRgbPng, resizeImage, pngInfo, writeFile, sleep } = require('./lib.cjs');
const G = require('./game.cjs');
const C = require('./compose.cjs');
const CFG = require('./shots-config.cjs');

const OUT = process.env.STORE_SHOTS_OUT ? path.resolve(process.env.STORE_SHOTS_OUT) : path.join(ROOT, 'store', 'screenshots');
const FRAMES_DIR = path.join(ROOT, 'node_modules', '.cache', 'store-shots');
const MANIFEST_JSON = path.join(OUT, 'manifest.json');

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const words = args.filter((a) => !a.startsWith('--'));
const LAYOUT_ONLY = flags.includes('--layout');
const KEEP_FRAMES = flags.includes('--frames');
const langs = CFG.LANGS.filter((l) => !words.some((w) => CFG.LANGS.includes(w)) || words.includes(l));
const deviceIds = CFG.DEVICE_IDS.filter((d) => !words.some((w) => CFG.DEVICE_IDS.includes(w)) || words.includes(d));
const sceneWords = words.filter((w) => !CFG.LANGS.includes(w) && !CFG.DEVICE_IDS.includes(w));
const scenes = CFG.SCENES.filter((s) => sceneWords.length === 0 || sceneWords.includes(s.id));
for (const w of sceneWords) if (!CFG.SCENES.some((s) => s.id === w)) throw new Error('unknown scene "' + w + '" (scenes: ' + CFG.SCENES.map((s) => s.id).join(', ') + ')');

const rel = (file) => path.relative(OUT, file).split(path.sep).join('/');
const rawFile = (device, lang, scene) => path.join(OUT, ...device.rawDir, lang, scene.file + '.png');
const finalFile = (device, lang, final) => path.join(OUT, ...device.finalDir, lang, String(final.n).padStart(2, '0') + '-' + final.slug + '.png');
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const other = (lang) => (lang === 'en' ? 'ar' : 'en');

const WORLD_NAMES = { oasis: 'Oasis', dunes: 'Dunes', bazaar: 'Bazaar', palace: 'Palace', caverns: 'Caverns', stars: 'Starlit Sky' };

function loadManifest() {
  try {
    const m = JSON.parse(fs.readFileSync(MANIFEST_JSON, 'utf8'));
    if (m && typeof m === 'object' && m.captures && m.finals) return m;
  } catch (_err) {
    // none yet
  }
  return { captures: {}, finals: {} };
}

function gameVersion() {
  const git = (...a) => {
    try {
      return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch (_err) {
      return '';
    }
  };
  const commit = git('rev-parse', '--short', 'HEAD');
  const dirty = git('status', '--porcelain', '--', 'src', 'index.html').length > 0;
  let version = '';
  try {
    version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
  } catch (_err) {
    version = '';
  }
  return { version, commit: commit || 'unknown', sourceEditedSinceCommit: dirty };
}

// ───────────────────────────── choosing a frame ─────────────────────────────

/**
 * How much of an effect a frame shows: the share of near-white pixels on the board (the light of
 * the effect, counted up to a ceiling so a white-out does not win) plus the share of strongly
 * coloured pixels (gems still on the board).
 */
function effectScore(png, rect) {
  const img = decodePng(png);
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(img.width, Math.ceil(rect.x + rect.w));
  const y1 = Math.min(img.height, Math.ceil(rect.y + rect.h));
  let white = 0;
  let colour = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * img.width + x) * img.channels;
      const r = img.data[i];
      const g = img.data[i + 1];
      const b = img.data[i + 2];
      const mn = r < g ? (r < b ? r : b) : g < b ? g : b;
      const mx = r > g ? (r > b ? r : b) : g > b ? g : b;
      if (mn > 235) white++;
      if (mx - mn > 110 && mx > 150) colour++;
      n++;
    }
  }
  const w = (100 * white) / n;
  const c = (100 * colour) / n;
  return { white: w, colour: c, score: Math.min(w, 22) * 2 + c };
}

// ───────────────────────────── planning ─────────────────────────────

function startBoosters(scene) {
  const out = {};
  for (const id of scene.picks || []) out[id] = true;
  const wins = scene.caravan || 0;
  if (wins >= 1) out.beamNova = true;
  if (wins >= 2) out.prism = true;
  if (wins >= 3) out.extraMoves = true;
  return out;
}

const range = (n) => Array.from({ length: n }, (_v, i) => i + 1);

/**
 * Decides, with the game's own level list and engine, which level a scene shows and which line of
 * play leads to its moment. Runs on any page of the game. → { level, theme, seed, moves, boosters, … }
 */
async function planScene(page, scene) {
  const candidates = await G.pickLevels(page, scene.level);
  if (candidates.length === 0) throw new Error('no shipped level fits scene "' + scene.id + '"');
  // the Caravan exists from level 20: below that the start boosters must be picked by hand
  let best = null;
  for (const cand of candidates.slice(0, 5)) {
    const boosters = startBoosters(scene);
    const base = { level: cand.id, theme: cand.theme, chapter: cand.chapter, kinds: cand.kinds, cols: cand.cols, rows: cand.rows, boosters };
    if (scene.kind === 'calm' || scene.kind === 'hammer') return Object.assign(base, { seed: 7, moves: [], score: 0 });
    if (scene.kind === 'win') {
      const res = await G.planWin(page, { level: cand.id, boosters, seeds: range(scene.plan.seeds) });
      if (!res) continue;
      const plan = Object.assign(base, { seed: res.seed, moves: res.moves, stars: res.stars, score: res.stars, endScore: res.score });
      if (res.stars === 3) return plan;
      if (!best || plan.score > best.score) best = plan;
      continue;
    }
    const res = await G.planMoment(page, { level: cand.id, boosters, seeds: range(scene.plan.seeds), depth: scene.plan.depth, wish: scene.plan.wish, min: scene.plan.min });
    if (!res) continue;
    const plan = Object.assign(base, { seed: res.seed, moves: res.moves, score: res.score, stats: res.stats });
    if (res.score >= scene.plan.min) return plan;
    if (!best || plan.score > best.score) best = plan;
  }
  if (!best) throw new Error('no line of play found for scene "' + scene.id + '"');
  return best;
}

// ───────────────────────────── capturing ─────────────────────────────

/** First line of an error, without the page URL (it carries a whole save). */
const brief = (err) => String(err && err.message ? err.message : err).split('\n')[0].replace(/https?:\/\/\S+/g, (u) => u.split('?')[0] + (u.indexOf('?') >= 0 ? '?…' : '')).slice(0, 300);

const fmtMove = (m) => '(' + m.a.c + ',' + m.a.r + ')↔(' + m.b.c + ',' + m.b.r + ')';

async function boardRect(page, scale) {
  const r = await page.evaluate(() => {
    const p = window.__play;
    const s = p.snapshot();
    const cell = p.shown().cell;
    const a = p.cell(0, 0);
    const z = p.cell(s.cols - 1, s.rows - 1);
    return { x: a.x - cell / 2, y: a.y - cell / 2, w: z.x - a.x + cell, h: z.y - a.y + cell };
  });
  return { x: r.x * scale, y: r.y * scale, w: r.w * scale, h: r.h * scale };
}

/** The state every capture is checked against: no test store, the language asked for, no error toast. */
async function pageFacts(page) {
  return page.evaluate(() => {
    const a = window.__app;
    return {
      lang: a.ctx.i18n.lang(),
      dir: document.documentElement.getAttribute('dir'),
      store: a.store.iapAvailable() ? 'a store answered' : 'none',
      rewardedReady: a.store.rewardedReady(),
      levels: a.world.levels.length,
      mock: a.flags.mockLevels > 0,
      gateOff: a.flags.gateOff === true,
      frontier: a.profile.highestUnlocked(),
      coins: a.profile.coins(),
      stars: a.profile.totalStars(),
      font: document.fonts.check("800 20px 'Baloo Bhaijaan 2 Variable'", 'Zumurud زمرد'),
    };
  });
}

/**
 * One capture. Returns { png, meta } — png is the screenshot exactly as the browser took it
 * (re-encoded without an alpha channel, nothing else).
 */
async function captureScene(browser, base, scene, lang, device, plans, problems) {
  const tag = device.id + '/' + lang + '/' + scene.file;
  const levelScene = ['moment', 'praise', 'calm', 'hammer', 'win'].includes(scene.kind);
  const meta = { scene: scene.id, what: scene.what, lang, device: device.id, viewport: device.w + '×' + device.h + ' CSS px × ' + device.scale };
  let page;
  let shot;
  try {
    if (!levelScene) {
      const journey = Object.assign({}, CFG.JOURNEY, { caravan: scene.caravan || 0, daily: scene.kind === 'daily' ? 'ready' : 'claimed' });
      const query = { still: '1' };
      if (scene.kind !== 'title') query.screen = 'map';
      page = await G.openGame(browser, { base, lang, device, save: G.makeSave(journey), query, problems, tag });
      meta.save = 'levels 1–' + journey.reached + ' cleared, ' + journey.coins + ' coins, 5 lives' + (journey.caravan ? ', Caravan streak ' + journey.caravan : '') + (scene.kind === 'daily' ? ', daily gift of day 4 not yet taken' : '');
      meta.flags = 'still=1 (idle sparkle loops stand still)';
      const next = journey.reached + 1;
      if (scene.kind === 'title') {
        await sleep(900);
        meta.moment = 'title screen after start-up';
      } else if (scene.kind === 'map') {
        await sleep(1500);
        if (await page.evaluate(() => window.__app.kit.hasOverlay())) {
          await page.evaluate(() => window.__app.kit.closeAll());
          await sleep(600);
        }
        meta.moment = 'map as it opens, scrolled by the game to the current level ' + next;
      } else if (scene.kind === 'intro') {
        await sleep(700);
        await G.goto(page, 'intro', next);
        await page.waitForSelector('[data-dialog="intro"] [data-act="intro-play"]', { timeout: 15000 });
        await sleep(1000);
        meta.level = next;
        meta.moment = 'intro dialog of the current level ' + next + ' (tap on its map node)';
      } else if (scene.kind === 'daily') {
        await sleep(1300);
        if (!(await page.$('[data-dialog="daily"]'))) await G.goto(page, 'daily');
        await page.waitForSelector('[data-dialog="daily"]', { timeout: 15000 });
        await sleep(1100);
        meta.moment = 'daily gift dialog, day 4 of the seven-day cycle ready to take';
      } else if (scene.kind === 'shop') {
        await sleep(700);
        await G.goto(page, 'shop');
        await page.waitForSelector('.m-dialog-shop', { timeout: 15000 });
        await sleep(1200);
        meta.moment = 'shop dialog as it opens: boosters for coins (no store is connected, so no money price exists)';
      }
      shot = await page.screenshot({ type: 'png' });
    } else {
      // ── a level ──
      let plan = plans[scene.id];
      let boosters = null;
      for (let attempt = 0; ; attempt++) {
        const save = G.makeSave({ reached: plan.level - 1, coins: CFG.JOURNEY.coins, caravan: scene.caravan || 0 });
        const query = { seed: String(plan.seed), screen: 'map' };
        if (scene.kind === 'win') query.fast = '1';
        page = await G.openGame(browser, { base, lang, device, save, query, problems, tag });
        boosters = await G.startLevel(page, plan.level, scene.picks || []);
        const same = JSON.stringify(Object.keys(boosters).sort()) === JSON.stringify(Object.keys(plan.boosters).sort());
        if (same && (await G.boardMatches(page, { level: plan.level, boosters: plan.boosters }, plan.seed))) break;
        // the game changed under us (someone is editing levels): plan again on this very version
        if (attempt >= 2) throw new Error('the board on screen is not the planned one (level ' + plan.level + ', seed ' + plan.seed + ')');
        plan = await planScene(page, scene);
        plans[scene.id] = plan;
        await G.closeGame(page);
        page = null;
      }
      const world = WORLD_NAMES[plan.theme] || plan.theme;
      meta.level = plan.level;
      meta.world = world;
      meta.seed = plan.seed;
      meta.startBoosters = Object.keys(boosters).length ? Object.keys(boosters).join(' + ') + ((scene.caravan || 0) > 0 ? ' (brought by the Caravan, streak ' + scene.caravan + ')' : '') : 'none';
      meta.save = 'levels 1–' + (plan.level - 1) + ' cleared; level ' + plan.level + ' is the current level, played for the first time';
      meta.flags = 'seed=' + plan.seed + (scene.kind === 'win' ? ', fast=1 (the playthrough runs faster; the dialog is the same)' : '');
      meta.moves = plan.moves.map(fmtMove);

      if (scene.kind === 'calm') {
        await sleep(1900);
        meta.moment = 'start of the level, before the first move';
        shot = await page.screenshot({ type: 'png' });
      } else if (scene.kind === 'hammer') {
        await sleep(1700);
        await page.click('.pl-boost[data-booster="hammer"] button');
        await sleep(650);
        meta.moment = 'start of the level, Hammer booster tapped: the game asks which piece to strike';
        shot = await page.screenshot({ type: 'png' });
      } else if (scene.kind === 'win') {
        await sleep(500);
        const moves = plan.moves.slice();
        const last = moves.pop();
        for (const m of moves) await G.playMove(page, m);
        await page.evaluate((m) => window.__play.swap(m.a, m.b), last);
        await page.waitForSelector('[data-pl="win"]', { timeout: 90000 });
        await sleep(3200);
        const stars = await page.evaluate(() => window.__play.snapshot().stars);
        meta.moment = 'level won in ' + plan.moves.length + ' moves (the engine\'s own hint at every move); result dialog after its stars and score have counted up — ' + stars + ' stars';
        meta.stars = stars;
        shot = await page.screenshot({ type: 'png' });
      } else {
        await sleep(900);
        const moves = plan.moves.slice();
        const last = moves.pop();
        for (const m of moves) await G.playMove(page, m);
        await sleep(900);
        const trigger = () => page.evaluate((m) => window.__play.swap(m.a, m.b), last);
        if (scene.kind === 'praise') {
          await trigger();
          await page.waitForSelector('.pl-praise', { timeout: 30000, state: 'attached' });
          await sleep(430);
          await G.setPaused(page, true);
          shot = await page.screenshot({ type: 'png' });
          const word = await page.evaluate(() => {
            const el = document.querySelector('.pl-praise__word');
            return el ? el.textContent : '';
          });
          await G.setPaused(page, false);
          meta.moment = 'move ' + plan.moves.length + ' ' + fmtMove(last) + ' set off ' + plan.stats.cascades + ' cascades; frame taken while the game shows its praise word "' + word + '" (about 0.4 s after it appears)';
        } else {
          const rect = await boardRect(page, device.scale);
          const frames = await G.burst(page, trigger, scene.burst);
          let pick = 0;
          let top = -1;
          frames.forEach((f, i) => {
            f.fx = effectScore(f.png, rect);
            if (f.fx.score > top) {
              top = f.fx.score;
              pick = i;
            }
          });
          if (KEEP_FRAMES) {
            frames.forEach((f, i) =>
              writeFile(path.join(FRAMES_DIR, device.id + '-' + lang + '-' + scene.id + '-' + String(i).padStart(2, '0') + '-g' + f.g + '-w' + f.fx.white.toFixed(0) + '-c' + f.fx.colour.toFixed(0) + (i === pick ? '-PICKED' : '') + '.png'), f.png),
            );
          }
          shot = frames[pick].png;
          const fx = Object.keys(plan.stats.fx).map((k) => k + '×' + plan.stats.fx[k]).join(', ');
          meta.moment =
            'move ' + plan.moves.length + ' ' + fmtMove(last) + ' (' + fx + '); frame ' + (pick + 1) + ' of ' + frames.length + ' taken while the effect runs, about ' + frames[pick].t + ' ms after the swipe' +
            ' — chosen as the frame with the most effect light on the board (' + frames[pick].fx.white.toFixed(1) + ' % near-white, ' + frames[pick].fx.colour.toFixed(1) + ' % gem colour)';
        }
      }
    }

    const facts = await pageFacts(page);
    if (facts.lang !== lang) throw new Error('the game runs in "' + facts.lang + '", not "' + lang + '"');
    if (facts.store !== 'none' || facts.rewardedReady) throw new Error('a store answered — captures must be taken with the store switched off');
    if (facts.mock || facts.gateOff) throw new Error('a test switch is on (mock levels or gate=off)');
    if (!facts.font) throw new Error('the bundled font is not loaded');
    if (await page.$('.k-toast')) problems.push(tag + ' a toast is on screen');
    meta.store = 'no store connected (fakestore=0): no purchases, no ads, no money prices on screen';
    meta.levelsInGame = facts.levels;
    const png = toOpaqueRgbPng(shot);
    const info = pngInfo(png);
    if (info.width !== device.width || info.height !== device.height) throw new Error('captured ' + info.width + '×' + info.height + ', expected ' + device.width + '×' + device.height);
    return { png, meta };
  } finally {
    if (page) await G.closeGame(page).catch(() => undefined);
  }
}

// ───────────────────────────── layout ─────────────────────────────

async function layoutAll(browser, manifest, version) {
  const stage = await C.openStage(browser);
  let written = 0;
  const missing = [];
  for (const lang of langs) {
    for (const id of deviceIds) {
      const device = CFG.DEVICES[id];
      // sources and geometry first, then one font size for the whole set
      const jobs = [];
      for (const final of CFG.FINALS) {
        const scene = CFG.SCENES.find((s) => s.id === final.scene);
        const sourceLang = final.otherLang ? other(lang) : lang;
        const source = rawFile(device, sourceLang, scene);
        if (!fs.existsSync(source)) {
          missing.push(rel(source));
          continue;
        }
        const raw = decodePng(fs.readFileSync(source));
        jobs.push({ final, scene, source, sourceLang, raw, geo: C.geometry(CFG.LAYOUT, device, raw.width, raw.height), lines: final.caption[lang] });
      }
      if (jobs.length === 0) continue;
      const fontSize = await C.fitCaptions(stage, jobs.map((j) => ({ lang, lines: j.lines, geo: j.geo })), CFG.LAYOUT);
      for (const job of jobs) {
        const scaled = resizeImage(job.raw, job.geo.shot.w, job.geo.shot.h);
        const shotPng = encodeRgbPng(scaled.width, scaled.height, scaled.data, scaled.channels);
        const { png, measure } = await C.composeFinal(stage, { geo: job.geo, lang, lines: job.lines, tint: job.final.tint, fontSize, lineHeight: CFG.LAYOUT.lineHeight[lang], shotPng });
        const file = finalFile(device, lang, job.final);
        writeFile(file, png);
        written++;
        manifest.finals[rel(file)] = {
          n: job.final.n,
          lang,
          device: id,
          size: job.geo.W + '×' + job.geo.H,
          source: rel(job.source),
          sourceLang: job.sourceLang,
          caption: job.lines,
          alt: job.final.alt[lang],
          shot: job.geo.shot,
          radius: job.geo.radius,
          band: job.geo.band,
          captionBox: measure.captionBox,
          captionShare: Number(measure.captionShare.toFixed(4)),
          fontSize,
          bytes: png.length,
          sha256: sha256(png),
          sourceSha256: sha256(fs.readFileSync(job.source)),
        };
        console.log('  ' + rel(file) + '  ' + job.geo.W + '×' + job.geo.H + '  ' + Math.round(png.length / 1024) + ' KB  caption ' + (100 * measure.captionShare).toFixed(1) + ' % of the image, font ' + fontSize + ' px');
      }
    }
  }
  await stage.context().close();

  // contact sheets
  for (const lang of langs) {
    const rows = [];
    for (const id of CFG.DEVICE_IDS) {
      const device = CFG.DEVICES[id];
      const items = CFG.FINALS.map((final) => ({ file: finalFile(device, lang, final), label: String(final.n).padStart(2, '0') + ' · ' + final.caption[lang].join(' ') })).filter((it) => fs.existsSync(it.file));
      if (items.length === 0) continue;
      const h = 480;
      rows.push({ label: device.label + ' — ' + device.width + '×' + device.height + ' — ' + items.length + ' files', cell: { w: Math.round((h * device.width) / device.height), h }, items });
    }
    if (rows.length === 0) continue;
    const png = await C.contactSheet(browser, rows, 'Zumurud — store screenshots (' + (lang === 'ar' ? 'Arabic, ar' : 'English, en-US') + ') — game ' + version.version + ' @ ' + version.commit);
    writeFile(path.join(OUT, 'contact-' + lang + '.png'), png);
    console.log('  contact-' + lang + '.png  ' + pngInfo(png).width + '×' + pngInfo(png).height);
  }
  return { written, missing };
}

// ───────────────────────────── MANIFEST.md ─────────────────────────────

function writeManifestMd(manifest) {
  const L = [];
  const cell = (v) => String(v === undefined || v === null || v === '' ? '—' : v).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  L.push('# Store screenshots — audit manifest');
  L.push('');
  L.push('Written by `tools/store/make-screenshots.cjs`; do not edit by hand (run the tool again instead).');
  L.push('');
  L.push('**What this file proves.** Every screenshot in this folder is a capture of the real, running game:');
  L.push('');
  L.push('- the game itself (`index.html` → `src/main.ts`), never the play-demo harness, never a mock-up;');
  L.push('- only shipped levels (`src/levels` `LEVELS`, ' + (manifest.levelsInGame || 120) + ' levels) — the level number is listed for every capture;');
  L.push('- no simulated store: every capture is taken with the store switched off (`fakestore=0`), so no purchase offer, no ad button and no money price can be on screen; the tool checks this on every page and refuses the capture otherwise;');
  L.push('- no debug overlay, no test level list, no `gate=off`: the tool checks these too;');
  L.push('- the state is one a player reaches: a save that stands for normal progress, the level started from its own intro dialog, moves entered through the game\'s own move handler;');
  L.push('- mid-effect frames are genuine frames: the game runs in real time and is held with its own pause while the screenshot is taken;');
  L.push('- the pixels of a capture are never retouched. The files in `raw/` are the screenshots as taken (re-encoded as 24-bit PNG without alpha). An upload file is its raw capture **scaled as a whole**, with **rounded corners**, a **gold line and a plain background** around it and **one caption** above it — nothing else. `node tools/store/check-kit.cjs screenshots` scales every raw capture again and compares it with the upload file, pixel by pixel.');
  L.push('');
  L.push('Game version: `' + cell(manifest.game.version) + '`, commit `' + cell(manifest.game.commit) + '`' + (manifest.game.sourceEditedSinceCommit ? ' (with uncommitted edits under `src/` at capture time)' : '') + '. Captured: ' + cell(manifest.capturedAt) + '. Laid out: ' + cell(manifest.laidOutAt) + '.');
  L.push('');
  L.push('Board coordinates in the "moves" column are (column, row), counted from 0 at the top-left; `(3,5)↔(3,6)` is a swipe between those two cells. The same level, seed and moves give the same board again (the engine is deterministic), so every capture can be reproduced.');
  L.push('');

  for (const lang of CFG.LANGS) {
    L.push('## ' + (lang === 'ar' ? 'Arabic (ar)' : 'English (en-US)') + ' — files to upload');
    L.push('');
    for (const id of CFG.DEVICE_IDS) {
      const device = CFG.DEVICES[id];
      const rows = Object.keys(manifest.finals).filter((k) => manifest.finals[k].lang === lang && manifest.finals[k].device === id).sort();
      if (rows.length === 0) continue;
      L.push('### ' + device.label + ' — ' + device.width + '×' + device.height);
      L.push('');
      L.push('| # | Upload file | Caption | Shows (raw capture) | Language of the capture | Level · world | Seed | Moment | Caption area |');
      L.push('|---|---|---|---|---|---|---|---|---|');
      for (const key of rows) {
        const f = manifest.finals[key];
        const c = manifest.captures[f.source] || {};
        L.push(
          '| ' + [f.n, '`' + key + '`', f.caption.join(' '), '`' + f.source + '`', f.sourceLang, c.level ? c.level + ' · ' + (c.world || '') : c.what || '', c.seed, c.moment, (100 * f.captionShare).toFixed(1) + ' %'].map(cell).join(' | ') + ' |',
        );
      }
      L.push('');
    }
  }

  L.push('## Every raw capture');
  L.push('');
  L.push('| Raw capture | What | Language | Device viewport | Player save | Level · world | Seed | Start boosters | Moves played | Moment captured | Game flags | SHA-256 |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const key of Object.keys(manifest.captures).sort()) {
    const c = manifest.captures[key];
    L.push(
      '| ' +
        ['`' + key + '`', c.what, c.lang, c.viewport, c.save, c.level ? c.level + (c.world ? ' · ' + c.world : '') : '', c.seed, c.startBoosters, (c.moves || []).join(' '), c.moment, c.flags, '`' + String(c.sha256 || '').slice(0, 16) + '…`']
          .map(cell)
          .join(' | ') +
        ' |',
    );
  }
  L.push('');
  L.push('## Alt text for Play Console (at most ' + CFG.LIMITS.altMax + ' characters each)');
  L.push('');
  L.push('| # | English | Arabic |');
  L.push('|---|---|---|');
  for (const final of CFG.FINALS) L.push('| ' + final.n + ' | ' + cell(final.alt.en) + ' | ' + cell(final.alt.ar) + ' |');
  L.push('');
  writeFile(path.join(OUT, 'MANIFEST.md'), L.join('\n'));
}

// ───────────────────────────── main ─────────────────────────────

async function main() {
  const manifest = loadManifest();
  const version = gameVersion();
  const problems = [];
  let captured = 0;
  const t0 = Date.now();
  const browser = await chromium.launch();
  try {
    if (!LAYOUT_ONLY) {
      const server = await startServer(STORE_PORT);
      console.log('game: ' + server.base + (server.reused ? ' (a dev server that was already running)' : ' (dev server started, no hot reload)'));
      try {
        // plan every level scene once, on one page of the game
        const plans = {};
        const lab = await G.openGame(browser, { base: server.base, lang: 'en', device: { w: 360, h: 640, scale: 1 }, save: G.makeSave(CFG.JOURNEY), problems, tag: 'plan' });
        manifest.levelsInGame = await lab.evaluate(() => window.__app.world.levels.length);
        for (const scene of scenes) {
          if (!scene.level) continue;
          plans[scene.id] = await planScene(lab, scene);
          const p = plans[scene.id];
          console.log('  plan ' + scene.id + ': level ' + p.level + ' (' + (WORLD_NAMES[p.theme] || p.theme) + '), seed ' + p.seed + ', ' + p.moves.length + ' move(s)' + (p.stats ? ', ' + JSON.stringify(p.stats.fx) + ', cascades ' + p.stats.cascades : '') + (p.stars ? ', ' + p.stars + ' stars' : ''));
        }
        await G.closeGame(lab);

        for (const lang of langs) {
          for (const id of deviceIds) {
            const device = CFG.DEVICES[id];
            for (const scene of scenes) {
              if (!scene.devices.includes(id)) continue;
              const file = rawFile(device, lang, scene);
              let done = false;
              let lastError = null;
              for (let attempt = 0; attempt < 3 && !done; attempt++) {
                try {
                  const { png, meta } = await captureScene(browser, server.base, scene, lang, device, plans, problems);
                  writeFile(file, png);
                  meta.sha256 = sha256(png);
                  meta.bytes = png.length;
                  manifest.captures[rel(file)] = meta;
                  captured++;
                  done = true;
                  console.log('  ' + rel(file) + '  ' + device.width + '×' + device.height + '  ' + Math.round(png.length / 1024) + ' KB' + (meta.level ? '  level ' + meta.level : ''));
                } catch (err) {
                  lastError = err;
                }
              }
              if (!done) problems.push(rel(file) + ' was NOT captured: ' + brief(lastError));
            }
          }
        }
        manifest.capturedAt = new Date().toISOString();
        manifest.game = version;
      } finally {
        await server.stop();
      }
    }
    if (!manifest.game) manifest.game = version;

    console.log('layout');
    const laid = await layoutAll(browser, manifest, manifest.game);
    manifest.laidOutAt = new Date().toISOString();
    for (const m of laid.missing) problems.push('no capture for an upload file: ' + m);
    // forget entries whose files are gone
    for (const key of Object.keys(manifest.captures)) if (!fs.existsSync(path.join(OUT, key))) delete manifest.captures[key];
    for (const key of Object.keys(manifest.finals)) if (!fs.existsSync(path.join(OUT, key))) delete manifest.finals[key];
    writeFile(MANIFEST_JSON, JSON.stringify(manifest, null, 2) + '\n');
    writeManifestMd(manifest);
    console.log('make-screenshots: ' + captured + ' capture(s), ' + laid.written + ' upload file(s) → ' + path.relative(process.cwd(), OUT) + '  (' + Math.round((Date.now() - t0) / 1000) + ' s)');
  } finally {
    await browser.close();
  }
  if (problems.length) {
    console.log(problems.length + ' problem(s):');
    for (const p of problems.slice(0, 60)) console.log('  ' + p);
    process.exitCode = 1;
  } else {
    console.log('Now run: node tools/store/check-kit.cjs screenshots   — and look at store/screenshots/contact-en.png and contact-ar.png.');
  }
}

main().catch((err) => {
  console.error('make-screenshots: ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
