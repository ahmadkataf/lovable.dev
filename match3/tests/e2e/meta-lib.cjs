/**
 * Shared plumbing of the shell's end-to-end scripts (tests/e2e/meta*.cjs) and of tools/meta-shots.cjs:
 * servers, save fixtures, page helpers and the pass / fail bookkeeping.
 *
 * Port 5185 (META_PORT). A script asks for the server it needs:
 *   - `quietDevServer()`  the Vite dev server WITHOUT hot reload and file watching — other people edit
 *     files in this tree, and a reload in the middle of a test would break it. A dev server that is
 *     already listening on the port is reused as it is (fine while nobody edits).
 *   - `stockDevServer()`  `vite --port 5185 --strictPort`, hot reload on (the CSP boot check).
 *   - `previewServer()`   `vite build` into a private folder (never the shared dist/) + `vite preview`.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const PORT = Number(process.env.META_PORT || 5185);
const BASE = 'http://127.0.0.1:' + PORT + '/';
const VITE = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
/** The production build of the tests goes here, so a test run never touches the shared dist/. */
const BUILD_DIR = process.env.META_BUILD_DIR || path.join(ROOT, 'node_modules', '.cache', 'meta-build-' + PORT);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function get(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', () => resolve(null));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function waitForServer(want) {
  for (let i = 0; i < 160; i++) {
    const res = await get(BASE);
    if (res && res.status === 200 && want(res.body)) return true;
    await sleep(250);
  }
  return false;
}

async function waitForPortFree() {
  for (let i = 0; i < 40; i++) {
    if (!(await get(BASE))) return true;
    await sleep(150);
  }
  return false;
}

const isDevHtml = (html) => html.indexOf('/src/main.ts') >= 0;
const isProdHtml = (html) => html.indexOf('/src/main.ts') < 0 && html.indexOf('assets/') >= 0;

/** { stop() } of a dev server without hot reload / watching; reuses one that is already running. */
async function quietDevServer() {
  const existing = await get(BASE);
  if (existing && existing.status === 200) {
    if (!isDevHtml(existing.body)) throw new Error('port ' + PORT + ' serves something that is not the dev app');
    console.log('  (reusing the dev server that is already running — a file edit during the run reloads the page and breaks tests)');
    return { reused: true, stop: async () => undefined };
  }
  const vite = await import('vite');
  const server = await vite.createServer({ root: ROOT, logLevel: 'silent', server: { host: '127.0.0.1', port: PORT, strictPort: true, hmr: false, watch: null } });
  await server.listen();
  if (!(await waitForServer(isDevHtml))) {
    await server.close().catch(() => undefined);
    throw new Error('the quiet dev server did not start');
  }
  return {
    reused: false,
    stop: async () => {
      await server.close().catch(() => undefined);
      await waitForPortFree();
    },
  };
}

/** The stock dev server (hot reload on), as `npx vite --port 5185 --strictPort` starts it. */
async function stockDevServer() {
  const existing = await get(BASE);
  if (existing && existing.status === 200) {
    if (!isDevHtml(existing.body)) throw new Error('port ' + PORT + ' serves something that is not the dev app');
    return { reused: true, stop: async () => undefined };
  }
  const child = spawn(process.execPath, [VITE, '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  if (!(await waitForServer(isDevHtml))) {
    child.kill();
    throw new Error('the dev server did not start');
  }
  return {
    reused: false,
    stop: async () => {
      child.kill();
      await waitForPortFree();
    },
  };
}

/** Build for production into BUILD_DIR and serve it with `vite preview`. Returns { stop(), html, buildLog }. */
async function previewServer() {
  const existing = await get(BASE);
  if (existing && existing.status === 200) throw new Error('port ' + PORT + ' is in use: stop that server before the production part');
  // An in-process dev server sets NODE_ENV=development for this process: never hand that to the
  // build, or it would compile `import.meta.env.DEV` to true.
  const env = Object.assign({}, process.env, { NODE_ENV: 'production' });
  const build = spawnSync(process.execPath, [VITE, 'build', '--outDir', BUILD_DIR, '--emptyOutDir'], { cwd: ROOT, encoding: 'utf8', env });
  if (build.status !== 0) throw new Error('vite build failed:\n' + (build.stdout || '') + (build.stderr || ''));
  const buildLog = (build.stdout || '').trim().split('\n').slice(-3).join(' | ').replace(/\s+/g, ' ');
  const child = spawn(process.execPath, [VITE, 'preview', '--outDir', BUILD_DIR, '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore', env });
  if (!(await waitForServer(isProdHtml))) {
    child.kill();
    throw new Error('vite preview did not start');
  }
  return {
    buildLog,
    buildDir: BUILD_DIR,
    stop: async () => {
      child.kill();
      await waitForPortFree();
    },
  };
}

/** Every file under the production build folder, as { file, text } (text files only). */
function builtFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      const file = path.join(d, name);
      if (fs.statSync(file).isDirectory()) walk(file);
      else if (/\.(js|css|html)$/.test(name)) out.push({ file, text: fs.readFileSync(file, 'utf8') });
    }
  };
  walk(dir || BUILD_DIR);
  return out;
}

// ───────────────────────────── bookkeeping ─────────────────────────────

function createRunner(fileTag) {
  const run = {
    failures: 0,
    checks: 0,
    problems: [],
    currentTest: '',
    /** While > 0, console errors are expected (a test provokes them on purpose). */
    tolerate: 0,
    /** Console errors matching one of these are expected for the whole run. */
    allow: [],
    /** Contexts opened by the running test: closed when it ends, also when it threw. */
    openContexts: [],
    only: process.env.META_ONLY || '',
  };

  run.ok = (cond, what) => {
    run.checks++;
    if (cond) return true;
    run.failures++;
    console.log('    ✗ ' + what);
    return false;
  };

  run.eq = (actual, expected, what) => run.ok(actual === expected, what + ' — expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));

  run.watch = (page) => {
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (run.tolerate > 0) return;
      if (run.allow.some((re) => re.test(text))) return;
      if (type === 'error' || (type === 'warning' && /i18n|\[art\]|\[kit\]|\[shell\]|\[app\]|\[play\]|\[store\]|\[profile\]/.test(text))) run.problems.push('[' + run.currentTest + '] console ' + type + ': ' + text);
    });
    page.on('pageerror', (err) => {
      if (run.tolerate > 0) return;
      run.problems.push('[' + run.currentTest + '] uncaught: ' + err.message);
    });
  };

  run.test = async (name, fn) => {
    if (run.only && name.indexOf(run.only) < 0) return;
    run.currentTest = name;
    const before = run.failures;
    const seen = run.problems.length;
    const t0 = Date.now();
    try {
      await fn();
    } catch (err) {
      run.failures++;
      const stack = err && err.stack ? err.stack.split('\n') : [String(err)];
      console.log('    ✗ threw: ' + stack.slice(0, 2).concat(stack.filter((l) => l.indexOf(fileTag) >= 0).slice(0, 2)).join(' | '));
    }
    for (const context of run.openContexts) await context.close().catch(() => undefined);
    run.openContexts = [];
    await sleep(50);
    const bad = run.failures - before + (run.problems.length - seen);
    console.log((bad === 0 ? '  ✓ ' : '  ✗ ') + name + '  (' + (Date.now() - t0) + ' ms)');
    for (let i = seen; i < run.problems.length; i++) console.log('    ! ' + run.problems[i]);
  };

  /** Print the verdict and set the exit code. */
  run.finish = () => {
    const bad = run.failures + run.problems.length;
    console.log('');
    if (run.problems.length) {
      console.log('console problems:');
      for (const p of run.problems) console.log('  ! ' + p);
    }
    console.log(bad === 0 ? 'PASS  ' + run.checks + ' checks, no console errors, no CSP violations' : 'FAIL  ' + run.failures + ' failed check(s), ' + run.problems.length + ' console problem(s)');
    process.exitCode = bad === 0 ? 0 : 1;
    return bad === 0;
  };

  /**
   * Open the game in a fresh browser context. `query` = URL flags (debug=1 is added),
   * opts: { context: {…playwright context options}, init: fn, initArg, clock: epochMs | Date (installs
   * a fake clock BEFORE the page loads — drive it with page.clock), path, wait: false to skip the boot wait }.
   */
  run.open = async (browser, query, opts) => {
    const o = opts || {};
    const context = await browser.newContext(Object.assign({ viewport: { width: 360, height: 640 }, hasTouch: true, deviceScaleFactor: 1 }, o.context || {}));
    run.openContexts.push(context);
    await context.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => {
        console.error('CSP violation: ' + e.violatedDirective + ' blocked ' + (e.blockedURI || 'inline'));
      });
    });
    if (o.init) await context.addInitScript(o.init, o.initArg);
    const page = await context.newPage();
    run.watch(page);
    if (o.clock !== undefined) await page.clock.install({ time: o.clock });
    if (o.before) await o.before(page, context);
    await page.goto(url(query), { waitUntil: 'load' });
    if (o.wait !== false) {
      await page.waitForFunction(() => window.__booted === true && !!window.__app, null, { timeout: 30000 });
      if (o.clock !== undefined) await page.clock.runFor(300);
      else await sleep(300);
    }
    return { context, page };
  };

  return run;
}

// ───────────────────────────── fixtures ─────────────────────────────

const DAY = 86400000;

/** Local-calendar day number of an instant (the same rule as src/state `localDayNumber`). */
function dayNumber(ms) {
  const d = new Date(ms);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
}

const today = dayNumber(Date.now());

/**
 * A save with levels 1..upTo won. Options: coins, lives, lifeAgoMs (how long the running life timer
 * has been going), boosters, dailyDay, dailyStreak, gifted, caravan, firstDay, now (the instant the
 * save is "written", default Date.now()), stars (fixed stars for every level), lang, shop.
 */
function saveData(opts) {
  const o = Object.assign({ upTo: 0, coins: 2000, lives: 5, lifeAgoMs: 60000, boosters: {}, dailyDay: -1, dailyStreak: 0 }, opts || {});
  const at = typeof o.now === 'number' ? o.now : Date.now();
  const levels = {};
  for (let i = 1; i <= o.upTo; i++) levels[i] = { stars: o.stars || 1 + ((i * 7 + 1) % 3), best: 2400 + ((i * 373) % 4000) };
  const data = {
    version: 1,
    levels,
    coins: o.coins,
    lives: o.lives,
    lifeTimer: o.lives >= 5 ? 0 : at - o.lifeAgoMs,
    boosters: Object.assign({ hammer: 3, freeSwap: 2, shuffle: 1, extraMoves: 2, prism: 0, beamNova: 1 }, o.boosters),
    settings: { sfx: true, music: true, haptics: true, lang: o.lang || null },
    dailyDay: o.dailyDay,
    dailyStreak: o.dailyStreak,
    seen: o.seen || [],
    stats: { played: o.upTo, won: o.upTo, bestCascade: 4, totalScore: o.upTo * 3000 },
    // a player who started a while ago and has met every booster (no "new booster" pop-ups, daily reward open)
    firstDay: typeof o.firstDay === 'number' ? o.firstDay : dayNumber(at) - 30,
    gifted: o.gifted || ['beamNova', 'hammer', 'freeSwap', 'prism', 'shuffle', 'extraMoves'],
    caravan: o.caravan || 0,
  };
  if (o.shop) data.shop = o.shop;
  return data;
}

function encodeSave(data) {
  return Buffer.from(typeof data === 'string' ? data : JSON.stringify(data), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function saveParam(opts) {
  return encodeSave(saveData(opts));
}

function url(query) {
  const q = Object.assign({ debug: '1' }, query || {});
  return BASE + '?' + Object.keys(q).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(q[k])).join('&');
}

// ───────────────────────────── page helpers ─────────────────────────────

const state = (page) =>
  page.evaluate(() => {
    const a = window.__app;
    const lives = a.profile.lives();
    return {
      screen: a.shell.current(),
      root: a.shell.atRoot(),
      overlay: a.kit.hasOverlay(),
      coins: a.profile.coins(),
      lives: lives.count,
      nextInMs: lives.nextInMs,
      frontier: a.profile.highestUnlocked(),
      stars: a.profile.totalStars(),
      lang: a.ctx.i18n.lang(),
      dir: document.documentElement.getAttribute('dir'),
      dialogs: document.querySelectorAll('.k-overlay:not(.k-closing)').length,
      boosters: Object.assign({}, a.profile.data().boosters),
    };
  });

async function tap(page, selector) {
  const target = page.locator(selector).first();
  await target.waitFor({ state: 'visible', timeout: 8000 });
  await target.tap();
}

async function waitScreen(page, screen) {
  await page.waitForFunction((s) => window.__app.shell.current() === s, screen, { timeout: 8000 });
  await sleep(320);
}

/** Wait until exactly `n` dialogs are open, and past the moment a new dialog starts taking input. */
async function waitDialogs(page, n) {
  await page.waitForFunction((count) => document.querySelectorAll('.k-overlay:not(.k-closing)').length === count, n, { timeout: 8000 });
  await sleep(380); // the kit ignores backdrop taps / double activations for a moment after opening
}

async function back(page) {
  await page.keyboard.press('Escape');
  await sleep(330);
}

const boosterCount = (page, id) => page.evaluate((b) => window.__app.profile.boosterCount(b), id);

/** The test store's sheets (src/monetize/fake.ts): answer the purchase sheet / the ad. */
async function fakeSheet(page, choice) {
  await tap(page, '[data-testid="fake-' + choice + '"]');
}

async function fakeAd(page, watch) {
  await page.waitForSelector('[data-testid="fake-ad"]', { timeout: 5000 });
  if (watch) {
    await page.waitForSelector('[data-testid="fake-ad-close"]', { state: 'visible', timeout: 6000 });
    await tap(page, '[data-testid="fake-ad-close"]');
  } else {
    await tap(page, '[data-testid="fake-ad-skip"]');
  }
  await page.waitForSelector('[data-testid="fake-ad"]', { state: 'detached', timeout: 5000 });
}

/**
 * Runs in the page before anything else: makes a current Chromium behave like WebView 80 wherever
 * the game could tell the difference — APIs newer than Chrome 80 are gone (using one throws, which
 * the tests report) and the `inert` attribute does nothing (it only works from Chrome 102).
 * (The same shim as tools/kit-shots.cjs uses for the UI kit.)
 */
function webview80Shim() {
  const kill = (obj, name) => {
    if (!obj) return;
    try {
      delete obj[name];
    } catch (e) {
      // not configurable
    }
    try {
      if (name in obj) Object.defineProperty(obj, name, { value: undefined, configurable: true, writable: true });
    } catch (e) {
      // leave it
    }
  };
  const A = Array.prototype;
  const S = String.prototype;
  for (const n of ['at', 'findLast', 'findLastIndex', 'toSorted', 'toReversed', 'toSpliced', 'with']) kill(A, n);
  for (const n of ['at', 'replaceAll', 'isWellFormed', 'toWellFormed']) kill(S, n);
  for (const n of ['hasOwn', 'groupBy']) kill(Object, n);
  for (const n of ['any', 'withResolvers']) kill(Promise, n);
  for (const n of ['structuredClone', 'WeakRef', 'FinalizationRegistry', 'AggregateError', 'scheduler', 'reportError']) kill(window, n);
  for (const proto of [Element.prototype, Document.prototype, DocumentFragment.prototype]) kill(proto, 'replaceChildren');
  for (const n of ['checkVisibility', 'getAnimations', 'ariaLabel', 'ariaHidden', 'ariaChecked']) kill(Element.prototype, n);
  kill(Document.prototype, 'getAnimations');
  for (const n of ['roundRect', 'createConicGradient', 'reset', 'letterSpacing']) kill(CanvasRenderingContext2D.prototype, n);
  kill(Path2D.prototype, 'roundRect');
  if (window.AbortSignal) for (const n of ['timeout', 'any']) kill(AbortSignal, n);
  if (window.crypto) kill(Crypto.prototype, 'randomUUID');
  // `inert`: the attribute stays visible to scripts (under another name) but stops doing anything.
  const E = Element.prototype;
  const alias = (n) => (n === 'inert' ? 'data-shim-inert' : n);
  const set = E.setAttribute;
  const has = E.hasAttribute;
  const rem = E.removeAttribute;
  const get = E.getAttribute;
  E.setAttribute = function (n, v) {
    return set.call(this, alias(n), v);
  };
  E.hasAttribute = function (n) {
    return has.call(this, alias(n));
  };
  E.removeAttribute = function (n) {
    return rem.call(this, alias(n));
  };
  E.getAttribute = function (n) {
    return get.call(this, alias(n));
  };
  kill(HTMLElement.prototype, 'inert');
  window.__webview80 = true;
}

/**
 * The Android wrapper's bridge as a page init script (pass the save JSON as its argument): the
 * page then has `window.__native.back() / pause() / resume() / insets()`, and `window.__bridgeCalls`
 * records what the game told the wrapper.
 */
function androidBridge(json) {
  const calls = { atRoot: [], ready: 0, haptics: 0, saves: 0 };
  window.__bridgeCalls = calls;
  let saved = typeof json === 'string' ? json : '';
  window.AndroidBridge = {
    loadSave: () => saved,
    storeSave: (s) => {
      saved = s;
      calls.saves++;
    },
    haptic: () => {
      calls.haptics++;
    },
    setAtRoot: (v) => {
      calls.atRoot.push(v);
    },
    info: () => JSON.stringify({ versionName: '9.9.9', versionCode: 99, locale: 'en-US' }),
    rate: () => {},
    ready: () => {
      calls.ready++;
    },
  };
}

module.exports = {
  webview80Shim,
  androidBridge,
  ROOT,
  PORT,
  BASE,
  VITE,
  BUILD_DIR,
  DAY,
  today,
  sleep,
  get,
  isDevHtml,
  isProdHtml,
  quietDevServer,
  stockDevServer,
  previewServer,
  builtFiles,
  createRunner,
  dayNumber,
  saveData,
  encodeSave,
  saveParam,
  url,
  state,
  tap,
  waitScreen,
  waitDialogs,
  back,
  boosterCount,
  fakeSheet,
  fakeAd,
};
