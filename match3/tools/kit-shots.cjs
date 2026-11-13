/**
 * UI kit review tool (dev only). Drives kit-demo.html in Chromium.
 *
 *   node tools/kit-shots.cjs                 screenshots → shots/kit/*.png, then the behaviour checks
 *   node tools/kit-shots.cjs shots [filter]  screenshots only (filter = substring of the file name, e.g. "dlg-tall" or "-ar")
 *   node tools/kit-shots.cjs check           behaviour checks only (Back order, double-tap guard, promises, 320 px, …)
 *
 * Screenshots: every gallery section and every dialog scenario at 360×640, 412×915 and 800×1280,
 * in English (LTR) and Arabic (RTL), deviceScaleFactor 2; plus 320×480 and landscape 640×360 extras.
 *
 * Uses the dev server at http://127.0.0.1:5183 (KIT_PORT overrides); if none is running it starts
 * `vite --port 5183 --strictPort` itself and stops it afterwards.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.KIT_PORT || 5183);
const BASE = 'http://127.0.0.1:' + PORT + '/kit-demo.html';
const OUT = path.join(ROOT, 'shots', 'kit');

const VIEWPORTS = [
  { w: 360, h: 640 },
  { w: 412, h: 915 },
  { w: 800, h: 1280 },
];
const LANGS = [
  { lang: 'en', dir: 'ltr' },
  { lang: 'ar', dir: 'rtl' },
];
const SCENARIOS = ['basic', 'confirm', 'medal', 'tall', 'stack', 'result', 'lose', 'shop', 'long', 'locked', 'toasts'];
/** Extra sizes: the smallest supported phone and a phone in landscape. */
const EXTRAS = [
  { w: 320, h: 480, sections: ['buttons', 'shop', 'hud', 'controls'], scenarios: ['basic', 'tall', 'long', 'lose', 'result', 'shop', 'toasts'] },
  { w: 640, h: 360, sections: [], scenarios: ['basic', 'tall', 'result', 'shop', 'medal'] },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ping(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureServer() {
  if (await ping(BASE)) return null;
  const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const child = spawn(process.execPath, [vite, '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    if (await ping(BASE)) return child;
  }
  child.kill();
  throw new Error('dev server did not start on port ' + PORT);
}

function watch(page, problems) {
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') problems.push('[console ' + msg.type() + '] ' + msg.text());
  });
  page.on('pageerror', (err) => problems.push('[page exception] ' + err.message));
}

async function load(page, lang, open) {
  await page.goto(BASE + '?lang=' + lang + (open ? '&open=' + open : ''), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__kitDemo && window.__kitDemo.ready === true, null, { timeout: 60000 });
}

// ───────────────────────────── screenshots ─────────────────────────────

async function shootSize(browser, size, sections, scenarios, filter, problems) {
  let count = 0;
  for (const { lang, dir } of LANGS) {
    const context = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2, hasTouch: true });
    const page = await context.newPage();
    watch(page, problems);
    const tag = '-' + size.w + (size.w > size.h ? 'x' + size.h : '') + '-' + dir;

    const wantSections = sections.filter((name) => !filter || (name + tag).indexOf(filter) >= 0);
    if (wantSections.length) {
      await load(page, lang, '');
      for (const name of wantSections) {
        const node = await page.$('[data-shot="' + name + '"]');
        if (!node) {
          problems.push('missing section ' + name);
          continue;
        }
        await node.screenshot({ path: path.join(OUT, name + tag + '.png') });
        count++;
      }
    }
    for (const name of scenarios) {
      const file = 'dlg-' + name + tag;
      if (filter && file.indexOf(filter) < 0) continue;
      await load(page, lang, name);
      // let the open animation, the star pops and the number tween finish
      await sleep(name === 'result' ? 1900 : 700);
      await page.screenshot({ path: path.join(OUT, file + '.png') });
      count++;
      if (name === 'tall') {
        // the same dialog scrolled to its end
        await page.evaluate(() => {
          const body = document.querySelector('.k-dialog__body');
          if (body) body.scrollTop = body.scrollHeight;
        });
        await sleep(250);
        await page.screenshot({ path: path.join(OUT, file + '-end.png') });
        count++;
      }
    }
    await context.close();
  }
  return count;
}

async function shots(browser, filter, problems) {
  fs.mkdirSync(OUT, { recursive: true });
  const allSections = ['buttons', 'icon-buttons', 'shop', 'hud', 'controls', 'dialogs'];
  let count = 0;
  for (const size of VIEWPORTS) count += await shootSize(browser, size, allSections, SCENARIOS, filter, problems);
  for (const extra of EXTRAS) count += await shootSize(browser, extra, extra.sections, extra.scenarios, filter, problems);
  console.log('screenshots: ' + count + ' file(s) in ' + path.relative(ROOT, OUT));
}

// ───────────────────────────── checks ─────────────────────────────

/** Forbidden for Chrome 80 (docs/DESIGN.md §1) — checked in the kit's CSS sources. */
const FORBIDDEN_CSS = [
  ['flex gap / bare gap (grids use grid-gap)', /(^|[\s;{])(row-|column-)?gap\s*:/m],
  ['aspect-ratio', /aspect-ratio\s*:/],
  ['inset shorthand / inset-* logical offsets', /(^|[\s;{])inset(-inline|-block)?(-start|-end)?\s*:/m],
  [':is()', /:is\(/],
  [':where()', /:where\(/],
  [':has()', /:has\(/],
  ['container queries', /@container|container-type\s*:/],
  ['color-mix()', /color-mix\(/],
  ['dynamic viewport units (dvh, svh, lvh …)', /\d(dvh|dvw|svh|svw|lvh|lvw|dvmin|dvmax)\b/],
  [':focus-visible', /:focus-visible/],
  ['logical shorthands margin-inline / padding-inline / margin-block / padding-block', /(margin|padding)-(inline|block)\s*:/],
  ['@layer', /@layer\b/],
  ['individual transform properties (translate/scale/rotate)', /(^|[\s;{])(translate|scale|rotate)\s*:/m],
  ['CSS nesting (&)', /(^|\s)&[\s.:>+~\[]/m],
  ['env() outside the --safe-* tokens', null],
];

function cssCheck() {
  const failures = [];
  const files = [path.join(ROOT, 'src', 'ui', 'kit', 'kit.css'), path.join(ROOT, 'kit-demo.html')];
  for (const file of files) {
    // comments may name the forbidden features; only real rules count
    const text = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
    for (const [name, re] of FORBIDDEN_CSS) {
      if (re) {
        const m = re.exec(text);
        if (m) failures.push(path.basename(file) + ': uses ' + name + ' → "' + m[0].trim() + '"');
      } else {
        const lines = text.split('\n').filter((line) => line.indexOf('env(') >= 0 && !/^\s*--safe-(top|right|bottom|left)\s*:/.test(line));
        if (lines.length) failures.push(path.basename(file) + ': ' + name + ' → "' + lines[0].trim() + '"');
      }
    }
  }
  return failures;
}

async function checks(browser, problems) {
  const results = [];
  const ok = (name, pass, detail) => {
    results.push({ name, pass: !!pass, detail: detail || '' });
  };

  // ── static: forbidden CSS ──
  const cssFailures = cssCheck();
  ok('no forbidden CSS features in kit.css / kit-demo.html', cssFailures.length === 0, cssFailures.join('; '));

  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  watch(page, problems);
  const requests = [];
  page.on('request', (req) => requests.push(req.url()));
  await load(page, 'en', '');

  const demo = (fn, arg) => page.evaluate(fn, arg);
  const openCount = () => demo(() => document.querySelectorAll('.k-overlay.k-open').length);
  const settle = () => sleep(260);

  // ── fonts & network ──
  const fonts = requests.filter((u) => /\.woff2?(\?|$)/.test(u)).map((u) => u.split('/').pop().split('?')[0]);
  await load(page, 'ar', '');
  const fontsAr = requests.filter((u) => /\.woff2?(\?|$)/.test(u)).map((u) => u.split('/').pop().split('?')[0]);
  const uniqueFonts = Array.from(new Set(fontsAr)).sort();
  ok(
    'only the Arabic + Latin font subsets are loaded',
    uniqueFonts.length === 2 && /arabic/.test(uniqueFonts[0]) && /latin-wght/.test(uniqueFonts[1]),
    uniqueFonts.join(', ') + ' (en page: ' + Array.from(new Set(fonts)).join(', ') + ')',
  );
  const fontOk = await demo(() => document.fonts.check('700 16px "Baloo Bhaijaan 2 Variable"', 'Aa') && document.fonts.check('700 16px "Baloo Bhaijaan 2 Variable"', 'أب'));
  ok('fontsReady(): both scripts render in the bundled font', fontOk);
  const foreign = requests.filter((u) => !u.startsWith('http://127.0.0.1:' + PORT) && !u.startsWith('data:') && !u.startsWith('blob:'));
  ok('no requests leave the dev server', foreign.length === 0, foreign.slice(0, 3).join(', '));
  await load(page, 'en', '');

  // ── button: feedback + double activation guard ──
  await demo(() => {
    const d = window.__kitDemo;
    d.log.sfx.length = 0;
    d.log.haptics.length = 0;
  });
  await page.dblclick('#demo-guard');
  let state = await demo(() => ({ clicks: window.__kitDemo.log.clicks.guard || 0, sfx: window.__kitDemo.log.sfx.slice(), haptics: window.__kitDemo.log.haptics.slice() }));
  ok('double click activates a button once', state.clicks === 1, 'activations: ' + state.clicks);
  ok("activation plays 'button' + light haptic exactly once", state.sfx.join() === 'button' && state.haptics.join() === 'light', 'sfx=' + state.sfx.join() + ' haptics=' + state.haptics.join());
  await demo(() => {
    const b = document.getElementById('demo-guard');
    for (let i = 0; i < 5; i++) b.click();
  });
  state = await demo(() => ({ clicks: window.__kitDemo.log.clicks.guard || 0 }));
  ok('five synchronous clicks inside the cooldown are ignored', state.clicks === 1, 'activations: ' + state.clicks);
  await sleep(420);
  await page.click('#demo-guard');
  state = await demo(() => ({ clicks: window.__kitDemo.log.clicks.guard || 0 }));
  ok('the button works again after the cooldown', state.clicks === 2, 'activations: ' + state.clicks);

  await page.click('#demo-async');
  await sleep(400); // past the cooldown, the handler's promise (600 ms) is still pending
  await page.click('#demo-async');
  state = await demo(() => ({ clicks: window.__kitDemo.log.clicks.async || 0 }));
  ok('a button whose handler is still running ignores presses', state.clicks === 1, 'activations: ' + state.clicks);
  await sleep(450);
  await page.click('#demo-async');
  state = await demo(() => ({ clicks: window.__kitDemo.log.clicks.async || 0 }));
  ok('… and accepts them again once the handler settled', state.clicks === 2, 'activations: ' + state.clicks);

  // pressed state
  const box = await page.locator('#demo-guard').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const pressedDown = await demo(() => document.getElementById('demo-guard').classList.contains('k-pressed'));
  await sleep(120);
  const faceShift = await demo(() => new DOMMatrix(getComputedStyle(document.querySelector('#demo-guard .k-btn__face')).transform).m42);
  await page.mouse.move(box.x + box.width / 2, box.y - 60); // slide off: no activation
  await page.mouse.up();
  await sleep(150);
  const pressedUp = await demo(() => document.getElementById('demo-guard').classList.contains('k-pressed'));
  state = await demo(() => ({ clicks: window.__kitDemo.log.clicks.guard || 0 }));
  ok('pressed state shows while held (face sinks) and clears on release', pressedDown && faceShift > 2 && !pressedUp, 'faceShift=' + faceShift.toFixed(1) + 'px');
  ok('sliding off a button cancels the press', state.clicks === 2, 'activations: ' + state.clicks);

  // disabled button
  const disabledClicks = await demo(() => {
    const kit = window.__kitDemo.kit;
    let n = 0;
    const b = kit.button({ label: 'x', onClick: () => n++, disabled: true });
    document.body.appendChild(b);
    b.click();
    b.update({ disabled: false });
    b.click();
    b.update({ loading: true });
    b.click();
    const busy = b.getAttribute('aria-busy');
    b.remove();
    return { n, busy };
  });
  ok('disabled / loading buttons do not activate; update() re-enables', disabledClicks.n === 1 && disabledClicks.busy === 'true', JSON.stringify(disabledClicks));

  // ── dialogs: promises ──
  await demo(() => window.__kitDemo.open('basic'));
  await settle();
  state = await demo(() => ({ has: window.__kitDemo.kit.hasOverlay(), sfx: window.__kitDemo.log.sfx.slice(-1)[0], role: document.querySelector('.k-dialog').getAttribute('role'), modal: document.querySelector('.k-dialog').getAttribute('aria-modal') }));
  ok("openDialog shows a modal dialog and plays 'popupOpen'", state.has && state.sfx === 'popupOpen' && state.role === 'dialog' && state.modal === 'true', JSON.stringify(state));
  await page.click('.k-dialog__foot .k-btn--primary');
  await sleep(50);
  state = await demo(() => ({ result: window.__kitDemo.results.basic, has: window.__kitDemo.kit.hasOverlay(), sfx: window.__kitDemo.log.sfx.slice(-2).join() }));
  ok('a dialog button closes the dialog and resolves `closed` with its result', state.result === 'resume' && state.has === false, JSON.stringify(state));
  ok("closing plays 'popupClose' (after the button sound)", state.sfx === 'button,popupClose', state.sfx);
  await sleep(300);
  ok('the closed dialog is removed from the DOM', (await demo(() => document.querySelectorAll('.k-overlay').length)) === 0);

  await demo(() => window.__kitDemo.open('confirm'));
  await settle();
  await page.click('.k-dialog__foot .k-btn--danger');
  await sleep(50);
  ok('confirm → yes resolves true', (await demo(() => window.__kitDemo.results.confirm)) === true);
  await sleep(300);
  await demo(() => window.__kitDemo.open('confirm'));
  await settle();
  await page.click('.k-dialog__foot .k-btn--secondary');
  await sleep(50);
  ok('confirm → no resolves false', (await demo(() => window.__kitDemo.results.confirm)) === false);
  await sleep(300);

  await demo(() => window.__kitDemo.open('basic'));
  await settle();
  await page.click('.k-dialog__x');
  await sleep(50);
  ok('✕ closes a dismissible dialog with undefined', (await demo(() => window.__kitDemo.results.basic)) === 'undefined');
  await sleep(300);

  await demo(() => window.__kitDemo.open('basic'));
  await sleep(120);
  await page.mouse.click(8, 8); // too early: inside the grace period
  await sleep(30);
  const early = await demo(() => window.__kitDemo.kit.hasOverlay());
  await sleep(400);
  await page.mouse.click(8, 8);
  await sleep(50);
  state = await demo(() => ({ result: window.__kitDemo.results.basic, has: window.__kitDemo.kit.hasOverlay() }));
  ok('a backdrop tap right after opening is ignored; a later one dismisses', early === true && state.has === false && state.result === 'undefined', 'early=' + early + ' ' + JSON.stringify(state));
  await sleep(300);

  // double tap on a dialog button: the second tap must not reach what is underneath
  const sumClicks = () => demo(() => Object.values(window.__kitDemo.log.clicks).reduce((x, y) => x + y, 0));
  await demo(() => {
    window.scrollTo(0, 0);
    window.__kitDemo.log.events.length = 0;
    window.__kitDemo.open('basic');
  });
  await settle();
  const clicksBefore = await sumClicks();
  const primary = await page.locator('.k-dialog__foot .k-btn--primary').boundingBox();
  const underneath = await demo(
    (p) => {
      const overlay = document.querySelector('.k-layer');
      overlay.style.display = 'none';
      const hit = document.elementFromPoint(p.x, p.y);
      overlay.style.display = '';
      return hit ? hit.className || hit.tagName : '';
    },
    { x: primary.x + primary.width / 2, y: primary.y + primary.height / 2 },
  );
  await page.mouse.dblclick(primary.x + primary.width / 2, primary.y + primary.height / 2);
  await sleep(60);
  state = await demo(() => ({ closes: window.__kitDemo.log.events.filter((e) => e.indexOf('closed:basic') === 0).length }));
  const clicksAfter = await sumClicks();
  ok('a double tap on a dialog button closes once and never reaches the screen underneath', state.closes === 1 && clicksAfter === clicksBefore, 'closes=' + state.closes + ' leaked=' + (clicksAfter - clicksBefore) + ' under=' + underneath);
  await sleep(300);

  // ── Back handling ──
  await demo(() => {
    window.__kitDemo.log.events.length = 0;
    window.__kitDemo.open('basic');
    window.__kitDemo.open('confirm');
  });
  await settle();
  state = await demo(() => ({ open: document.querySelectorAll('.k-overlay.k-open').length, under: document.querySelectorAll('.k-overlay.k-under').length, hiddenApp: document.getElementById('app').getAttribute('aria-hidden') }));
  ok('two dialogs stack; the lower one is marked as covered; the app is aria-hidden', state.open === 2 && state.under === 1 && state.hiddenApp === 'true', JSON.stringify(state));
  await page.keyboard.press('Escape');
  await sleep(60);
  state = await demo(() => ({ confirm: window.__kitDemo.results.confirm, basic: window.__kitDemo.results.basic, open: document.querySelectorAll('.k-overlay.k-open').length, has: window.__kitDemo.kit.hasOverlay() }));
  ok('Back closes the TOP dialog first (confirm → false), the lower one stays', state.confirm === false && state.basic === 'open' && state.open === 1 && state.has, JSON.stringify(state));
  await page.keyboard.press('Escape');
  await sleep(60);
  state = await demo(() => ({ basic: window.__kitDemo.results.basic, has: window.__kitDemo.kit.hasOverlay() }));
  ok('Back again closes the lower dialog (undefined)', state.basic === 'undefined' && state.has === false, JSON.stringify(state));
  await page.keyboard.press('Escape');
  await sleep(60);
  state = await demo(() => ({ events: window.__kitDemo.log.events.filter((e) => e.indexOf('back:') === 0), top: window.__kitDemo.kit.closeTop(), hiddenApp: document.getElementById('app').getAttribute('aria-hidden') }));
  ok('closeTop() returns true, true, then false when nothing is open', state.events.join() === 'back:true,back:true,back:false' && state.top === false, state.events.join());
  ok('the app is un-hidden once the stack is empty', state.hiddenApp === null);
  await sleep(300);

  await demo(() => window.__kitDemo.open('locked'));
  await settle();
  const back1 = await demo(() => window.__kitDemo.kit.closeTop());
  await page.mouse.click(8, 8);
  await sleep(450);
  await page.mouse.click(8, 8);
  await sleep(60);
  state = await demo(() => ({ has: window.__kitDemo.kit.hasOverlay(), x: document.querySelectorAll('.k-dialog__x').length, result: window.__kitDemo.results.locked }));
  ok('dismissible:false — Back is swallowed (returns true), no ✕, backdrop taps do nothing', back1 === true && state.has === true && state.x === 0 && state.result === 'open', 'back=' + back1 + ' ' + JSON.stringify(state));
  await demo(() => window.__kitDemo.kit.closeAll());
  await sleep(60);
  ok('closeAll() empties the stack', (await demo(() => window.__kitDemo.kit.hasOverlay())) === false);
  await sleep(300);

  // ── blocking underneath ──
  await demo(() => window.__kitDemo.open('basic'));
  await settle();
  const guardBox = await page.locator('#demo-guard').boundingBox();
  state = await demo(
    (p) => {
      const hit = document.elementFromPoint(p.x, p.y);
      return { blocked: !!hit && !!hit.closest('.k-overlay'), tag: hit ? hit.className : '' };
    },
    { x: guardBox.x + guardBox.width / 2, y: guardBox.y + guardBox.height / 2 },
  );
  ok('pointer events are blocked under a dialog', state.blocked, state.tag);
  const focusTrail = [];
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press(i === 5 ? 'Shift+Tab' : 'Tab');
    focusTrail.push(await demo(() => !!document.activeElement && !!document.activeElement.closest('.k-dialog')));
  }
  ok('keyboard focus stays inside the top dialog (Tab / Shift+Tab)', focusTrail.every(Boolean), focusTrail.join());
  ok('keyboard use switches the focus ring on', await demo(() => document.documentElement.classList.contains('k-kbd')));
  await demo(() => window.__kitDemo.kit.closeAll());
  await sleep(300);

  // ── tall dialog scrolls inside ──
  await demo(() => window.__kitDemo.open('tall'));
  await settle();
  state = await demo(() => {
    const body = document.querySelector('.k-dialog__body');
    const wrap = document.querySelector('.k-dialog__bodywrap');
    const panel = document.querySelector('.k-dialog').getBoundingClientRect();
    const foot = document.querySelector('.k-dialog__foot .k-btn').getBoundingClientRect();
    const before = { up: wrap.classList.contains('k-can-up'), down: wrap.classList.contains('k-can-down') };
    body.scrollTop = body.scrollHeight;
    return { scrolls: body.scrollHeight > body.clientHeight + 20, top: panel.top, bottom: panel.bottom, footBottom: foot.bottom, vh: innerHeight, before };
  });
  await sleep(200);
  const after = await demo(() => {
    const wrap = document.querySelector('.k-dialog__bodywrap');
    return { up: wrap.classList.contains('k-can-up'), down: wrap.classList.contains('k-can-down') };
  });
  ok('a tall dialog fits the viewport and its body scrolls inside', state.scrolls && state.top >= 0 && state.bottom <= state.vh && state.footBottom <= state.vh, JSON.stringify(state));
  ok('scroll hints follow the scroll position', state.before.down && !state.before.up && after.up && !after.down, JSON.stringify({ before: state.before, after }));
  await demo(() => window.__kitDemo.kit.closeAll());
  await sleep(300);

  // ── toasts ──
  await demo(() => {
    const kit = window.__kitDemo.kit;
    kit.toast('one', { duration: 500 });
    kit.toast('two', { duration: 5000 });
    kit.toast('two', { duration: 5000 });
    kit.toast('three', { duration: 5000 });
    kit.toast('four', { duration: 5000 });
  });
  await sleep(350);
  state = await demo(() => ({
    texts: Array.from(document.querySelectorAll('.k-toast:not(.k-out)')).map((n) => n.textContent),
    pointer: getComputedStyle(document.querySelector('.k-toasts')).pointerEvents,
    has: window.__kitDemo.kit.hasOverlay(),
  }));
  ok('toasts stack (max 3, duplicates merge), do not block input and are not overlays', state.texts.join() === 'two,three,four' && state.pointer === 'none' && state.has === false, JSON.stringify(state));
  await demo(() => window.__kitDemo.kit.toast('short', { duration: 300 }));
  await sleep(900);
  ok('a toast dismisses itself', (await demo(() => Array.from(document.querySelectorAll('.k-toast')).map((n) => n.textContent).indexOf('short'))) === -1);

  // ── widgets ──
  state = await demo(async () => {
    const d = window.__kitDemo;
    const kit = d.kit;
    const span = document.createElement('span');
    document.body.appendChild(span);
    const p = kit.tweenNumber(span, 0, 12345, 200);
    await new Promise((r) => setTimeout(r, 80));
    const mid = span.textContent;
    await p;
    const end = span.textContent;
    span.remove();
    const chip = kit.chip({ icon: 'coin', text: '1' });
    document.body.appendChild(chip.el);
    chip.set('2');
    const bumped = chip.el.classList.contains('k-bump');
    chip.el.remove();
    const prog = kit.progress({ value: 5, max: 10, notches: [2, 8] });
    document.body.appendChild(prog.el);
    const p1 = prog.el.style.getPropertyValue('--k-p');
    const on = Array.from(prog.el.querySelectorAll('.k-progress__notch')).map((n) => n.classList.contains('k-on'));
    prog.set(9);
    const on2 = Array.from(prog.el.querySelectorAll('.k-progress__notch')).map((n) => n.classList.contains('k-on'));
    prog.el.remove();
    const stars = kit.starRow(2);
    const starsOn = stars.el.querySelectorAll('.k-star.k-on').length;
    let done = 0;
    const cd = kit.countdown({ until: Date.now() + 600, onDone: () => done++ });
    document.body.appendChild(cd.el);
    const cdText = cd.el.textContent;
    await new Promise((r) => setTimeout(r, 1000));
    const cdEnd = cd.el.textContent;
    cd.el.remove();
    return { mid, end, bumped, p1, on, on2, starsOn, cdText, cdEnd, done };
  });
  ok('tweenNumber counts up and ends on the formatted target', state.end === '12,345' && state.mid !== '12,345' && state.mid !== '0', 'mid=' + state.mid + ' end=' + state.end);
  ok('chip.set() changes the text and bumps', state.bumped);
  ok('progress fills and lights the reached star notches', state.p1 === '0.5' && state.on.join() === 'true,false' && state.on2.join() === 'true,true', JSON.stringify([state.p1, state.on, state.on2]));
  ok('starRow lights the earned stars', state.starsOn === 2);
  ok('countdown ticks down to 00:00 and calls onDone once', state.cdText === '00:01' && state.cdEnd === '00:00' && state.done === 1, JSON.stringify([state.cdText, state.cdEnd, state.done]));

  await demo(() => (window.__kitDemo.log.events.length = 0));
  await page.click('#demo-toggle');
  await page.click('#demo-seg .k-seg__opt:nth-child(4)');
  state = await demo(() => ({ events: window.__kitDemo.log.events.slice(), checked: document.getElementById('demo-toggle').getAttribute('aria-checked'), seg: document.querySelector('#demo-seg .k-seg__opt.k-on').textContent }));
  ok('toggle and segmented report changes', state.events.join() === 'music:false,seg:hard' && state.checked === 'false' && state.seg === 'Hard', JSON.stringify(state));

  // ── safe areas ──
  state = await demo(() => {
    const d = window.__kitDemo;
    const screen = d.kit.screen('probe');
    document.body.appendChild(screen);
    const cs = getComputedStyle(screen);
    const before = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(' ');
    d.setSafeInsets({ top: 40, right: 20, bottom: 30, left: 10 });
    const after = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(' ');
    d.open('basic');
    const o = getComputedStyle(document.querySelector('.k-overlay'));
    const overlay = [o.paddingTop, o.paddingRight, o.paddingBottom, o.paddingLeft].map(parseFloat);
    d.kit.toast('safe', { duration: 400 });
    const toastTop = parseFloat(getComputedStyle(document.querySelector('.k-toasts')).top);
    d.kit.closeAll();
    d.setSafeInsets({ top: 0, right: 0, bottom: 0, left: 0 });
    screen.remove();
    return { before, after, overlay, toastTop };
  });
  ok(
    'safe-area tokens default to 0 and setSafeInsets() pads screens, dialogs and toasts',
    state.before === '0px 0px 0px 0px' && state.after === '40px 20px 30px 10px' && state.overlay[0] === 56 && state.overlay[1] === 32 && state.overlay[2] === 46 && state.overlay[3] === 22 && state.toastTop === 52,
    JSON.stringify(state),
  );
  await sleep(500);

  // ── global behaviour ──
  state = await demo(() => {
    const cs = getComputedStyle(document.getElementById('app'));
    return { select: cs.userSelect, touch: cs.touchAction, over: cs.overscrollBehaviorY, tap: cs.webkitTapHighlightColor };
  });
  ok('#app: no text selection, no double-tap zoom, no overscroll, no tap highlight', state.select === 'none' && state.touch === 'pan-x pan-y' && state.over === 'none' && /, 0\)$/.test(state.tap), JSON.stringify(state));

  // ── touch targets & horizontal overflow, 320 px and 360 px, both directions ──
  for (const width of [320, 360]) {
    for (const { lang, dir } of LANGS) {
      await page.setViewportSize({ width, height: width === 320 ? 480 : 640 });
      await load(page, lang, '');
      state = await demo(() => {
        const small = [];
        const nodes = document.querySelectorAll('#app .k-btn, #app .k-chip--button, #app .k-toggle, #app .k-seg');
        for (const node of nodes) {
          const r = node.getBoundingClientRect();
          const slop = getComputedStyle(node, '::after');
          const extraY = slop.content !== 'none' && slop.position === 'absolute' ? -(parseFloat(slop.top) || 0) - (parseFloat(slop.bottom) || 0) : 0;
          const extraX = slop.content !== 'none' && slop.position === 'absolute' ? -(parseFloat(slop.left) || 0) - (parseFloat(slop.right) || 0) : 0;
          const h = r.height + Math.max(0, extraY);
          const w = r.width + Math.max(0, extraX);
          if (h < 48 || w < 48) small.push(node.className.replace(/k-btn--/g, '').slice(0, 40) + ' ' + w.toFixed(1) + '×' + h.toFixed(1));
        }
        const doc = document.documentElement;
        const wide = [];
        for (const node of document.querySelectorAll('#app *')) {
          const r = node.getBoundingClientRect();
          if (r.width > 0 && (r.right > doc.clientWidth + 0.5 || r.left < -0.5)) wide.push(node.className + ' ' + r.left.toFixed(1) + '…' + r.right.toFixed(1));
        }
        return { count: nodes.length, small, scrollW: doc.scrollWidth, clientW: doc.clientWidth, wide: wide.slice(0, 4), dir: doc.getAttribute('dir') };
      });
      ok('touch targets ≥ 48 px at ' + width + ' px (' + dir + ', ' + state.count + ' controls)', state.small.length === 0, state.small.slice(0, 6).join(' | '));
      ok('no horizontal scrollbar / overflow at ' + width + ' px (' + dir + ')', state.scrollW <= state.clientW && state.wide.length === 0 && state.dir === dir, 'scrollWidth=' + state.scrollW + ' clientWidth=' + state.clientW + ' ' + state.wide.join(' | '));

      for (const name of ['long', 'shop', 'lose', 'result', 'tall']) {
        await demo((n) => window.__kitDemo.open(n), name);
        await settle();
        const d = await demo(() => {
          const out = [];
          const vw = document.documentElement.clientWidth;
          const vh = window.innerHeight;
          for (const panel of document.querySelectorAll('.k-overlay.k-open .k-dialog')) {
            const r = panel.getBoundingClientRect();
            if (r.left < 0 || r.right > vw || r.top < 0 || r.bottom > vh) out.push('panel ' + [r.left, r.top, r.right, r.bottom].map((v) => v.toFixed(0)).join(','));
            const body = panel.querySelector('.k-dialog__body');
            if (body.scrollWidth > body.clientWidth + 1) out.push('body scrolls sideways ' + body.scrollWidth + '>' + body.clientWidth);
            for (const node of panel.querySelectorAll('.k-btn, .k-offer, .k-chip, .k-ribbon, .k-dialog__x, .k-medal')) {
              const b = node.getBoundingClientRect();
              if (b.left < -0.5 || b.right > vw + 0.5) out.push(node.className.slice(0, 30) + ' ' + b.left.toFixed(0) + '…' + b.right.toFixed(0));
            }
            for (const node of panel.querySelectorAll('.k-btn__label, .k-title, .k-offer__title')) {
              if (node.scrollWidth > node.clientWidth + 1) out.push('clipped text: ' + node.textContent.slice(0, 24));
            }
          }
          return { out, sw: document.documentElement.scrollWidth, cw: vw };
        });
        ok('dialog "' + name + '" fits at ' + width + ' px (' + dir + ')', d.out.length === 0 && d.sw <= d.cw, d.out.slice(0, 4).join(' | '));
        await demo(() => window.__kitDemo.kit.closeAll());
        await sleep(220);
      }
    }
  }

  // ── RTL mirroring ──
  await page.setViewportSize({ width: 360, height: 640 });
  for (const { lang, dir } of LANGS) {
    await load(page, lang, 'shop');
    await settle();
    state = await demo(() => {
      const panel = document.querySelector('.k-dialog').getBoundingClientRect();
      const x = document.querySelector('.k-dialog__x').getBoundingClientRect();
      const card = document.querySelector('.k-dialog .k-offer .k-ribbon').parentElement.getBoundingClientRect();
      const ribbon = document.querySelector('.k-dialog .k-offer .k-ribbon').getBoundingClientRect();
      const mid = (r) => (r.left + r.right) / 2;
      const knob = document.querySelector('#demo-toggle .k-switch__knob').getBoundingClientRect();
      const sw = document.querySelector('#demo-toggle .k-switch').getBoundingClientRect();
      const fill = document.querySelector('[data-shot="hud"] .k-progress:nth-child(2) .k-progress__fill').getBoundingClientRect();
      const track = document.querySelector('[data-shot="hud"] .k-progress:nth-child(2) .k-progress__track').getBoundingClientRect();
      return {
        xRight: mid(x) > mid(panel),
        ribbonRight: mid(ribbon) > mid(card),
        knobRight: mid(knob) > mid(sw),
        fillFromRight: Math.abs(fill.right - track.right) < Math.abs(fill.left - track.left),
        align: getComputedStyle(document.querySelector('[data-shot="controls"] .k-toggle__label')).textAlign,
      };
    });
    const ltr = dir === 'ltr';
    ok(
      dir.toUpperCase() + ': ✕, ribbon, switch knob (on) and progress fill sit on the ' + (ltr ? 'right/left-origin' : 'mirrored') + ' side',
      state.xRight === ltr && state.ribbonRight === ltr && state.knobRight === ltr && state.fillFromRight === !ltr && state.align === 'start',
      JSON.stringify(state),
    );
  }
  await context.close();

  // ── contrast of text on kit surfaces (WCAG, worst gradient stop) ──
  const ctx2 = await browser.newContext({ viewport: { width: 360, height: 640 } });
  const page2 = await ctx2.newPage();
  watch(page2, problems);
  await load(page2, 'en', 'shop');
  await sleep(300);
  const contrast = await page2.evaluate(() => {
    const parse = (s) => {
      const m = /rgba?\(([^)]+)\)/.exec(s);
      if (!m) return null;
      const p = m[1].split(',').map((v) => parseFloat(v));
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const lum = (c) => {
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const ratio = (a, b) => {
      const la = lum(a);
      const lb = lum(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };
    const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
    /** Opaque colours a surface can show behind text: every stop of its top gradient layer, else its background colour. */
    const surfaces = (node, base) => {
      const cs = getComputedStyle(node);
      const out = [];
      const image = cs.backgroundImage;
      if (image && image !== 'none') {
        // last layer = the solid base gradient
        const layers = image.split(/,\s*(?=(?:linear|radial|repeating-linear)-gradient)/);
        const last = layers[layers.length - 1];
        const re = /rgba?\([^)]+\)/g;
        let m;
        while ((m = re.exec(last))) out.push(over(parse(m[0]), base));
      }
      const bg = parse(cs.backgroundColor);
      if (!out.length && bg && bg.a > 0) out.push(over(bg, base));
      return out;
    };
    const night = { r: 20, g: 18, b: 58, a: 1 };
    const rows = [];
    const add = (name, textNode, surfaceNode, base) => {
      if (!textNode || !surfaceNode) {
        rows.push({ name, ratio: 0, note: 'missing' });
        return;
      }
      const cs = getComputedStyle(textNode);
      let color = parse(cs.webkitTextFillColor && cs.webkitTextFillColor !== 'rgba(0, 0, 0, 0)' ? cs.webkitTextFillColor : cs.color);
      if (cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)') color = parse(cs.color);
      const opacity = parseFloat(cs.opacity);
      const stops = surfaces(surfaceNode, base || night);
      let worst = Infinity;
      for (const s of stops) {
        const shown = opacity < 1 ? over({ r: color.r, g: color.g, b: color.b, a: opacity }, s) : color;
        worst = Math.min(worst, ratio(shown, s));
      }
      rows.push({ name, ratio: Math.round(worst * 100) / 100, size: cs.fontSize + '/' + cs.fontWeight });
    };
    const q = (sel) => document.querySelector(sel);
    const panel = q('.k-dialog__inner');
    const panelStops = surfaces(panel, night);
    const panelWorstLight = panelStops.reduce((a, b) => (lum(a) > lum(b) ? a : b));
    for (const v of ['primary', 'secondary', 'success', 'danger']) {
      const b = q('#app .k-btn--' + v + ':not(.k-btn--round):not(:disabled)');
      add('button ' + v, b && b.querySelector('.k-btn__label'), b && b.querySelector('.k-btn__face'));
    }
    const cap = q('#app .k-btn--secondary .k-btn__cap');
    add('button caption (secondary)', cap, cap && cap.closest('.k-btn__face'));
    const ad = q('#app .k-btn--ad');
    add('ad button', ad && ad.querySelector('.k-btn__label'), ad && ad.querySelector('.k-btn__face'));
    add('ad button caption', ad && ad.querySelector('.k-btn__cap'), ad && ad.querySelector('.k-btn__face'));
    const price = q('#app .k-btn--price.k-btn--success');
    add('price button', price && price.querySelector('.k-price'), price && price.querySelector('.k-btn__face'));
    add('price button caption', price && price.querySelector('.k-btn__cap'), price && price.querySelector('.k-btn__face'));
    const ghost = q('#app .k-btn--ghost .k-btn__label');
    add('ghost button on panel', ghost, panel);
    add('dialog title (fallback colour)', q('.k-dialog__title'), panel);
    add('offer title', q('.k-dialog .k-offer__title'), q('.k-dialog .k-offer'), panelWorstLight);
    add('offer subtitle', q('.k-dialog .k-offer__sub'), q('.k-dialog .k-offer--featured'), panelWorstLight);
    add('ribbon popular', q('.k-ribbon--popular span'), q('.k-ribbon--popular'));
    add('ribbon best', q('.k-ribbon--best span'), q('.k-ribbon--best'));
    add('ribbon new', q('#app .k-ribbon--new span'), q('#app .k-ribbon--new'));
    add('chip text', q('.k-chip__text'), q('.k-chip'), panelWorstLight);
    add('quantity badge', q('.k-qty'), q('.k-qty'), panelWorstLight);
    add('quantity badge gold', q('#app .k-qty--gold'), q('#app .k-qty--gold'));
    add('owned', q('#app .k-owned span:last-child'), q('#app .k-owned'), panelWorstLight);
    add('button badge', q('#app .k-badge'), q('#app .k-badge'));
    add('toggle label on panel', q('#app .k-toggle__label'), q('#app .k-panel__inner'));
    add('segmented selected', q('#app .k-seg__opt.k-on'), q('#app .k-seg__thumb'));
    add('segmented unselected', q('#app .k-seg__opt:not(.k-on)'), q('#app .k-seg'), panelWorstLight);
    add('muted text on panel', q('#app .k-panel .k-text--muted'), q('#app .k-panel__inner'));
    add('body text on panel', q('#app .k-panel .k-text'), q('#app .k-panel__inner'));
    add('countdown label', q('#app .k-countdown__label'), q('#app .k-panel__inner'));
    window.__kitDemo.kit.toast('contrast', { duration: 2000 });
    add('toast', q('.k-toast__text'), q('.k-toast'));
    return rows;
  });
  const low = contrast.filter((r) => r.ratio < 4.5);
  ok('text contrast ≥ 4.5:1 on every kit surface (' + contrast.length + ' pairs, worst ' + Math.min.apply(null, contrast.map((r) => r.ratio)) + ':1)', low.length === 0, low.map((r) => r.name + ' ' + r.ratio + ' ' + (r.note || '')).join(' | '));
  if (process.env.KIT_VERBOSE) for (const r of contrast) console.log('    contrast  ' + String(r.ratio).padEnd(6) + r.name + '  ' + (r.size || ''));
  await ctx2.close();

  // ── reduced motion ──
  const ctx3 = await browser.newContext({ viewport: { width: 360, height: 640 }, reducedMotion: 'reduce' });
  const page3 = await ctx3.newPage();
  watch(page3, problems);
  await load(page3, 'en', 'result');
  await sleep(120);
  state = await page3.evaluate(() => {
    const d = getComputedStyle(document.querySelector('.k-dialog'));
    const f = getComputedStyle(document.querySelector('#demo-guard .k-btn__face'));
    const s = getComputedStyle(document.querySelector('.k-star.k-on .k-on-icon'));
    return {
      reduced: window.__kitDemo.kit.reducedMotion(),
      dialog: d.transitionDuration,
      face: f.transitionDuration,
      star: s.animationName + ' ' + s.opacity,
      opacity: d.opacity,
      score: document.querySelector('.k-dialog .k-title--lg').textContent,
    };
  });
  const tiny = (v) => v.split(',').every((p) => parseFloat(p) <= 0.001);
  ok('prefers-reduced-motion: transitions collapse, stars and numbers jump to their end state', state.reduced && tiny(state.dialog) && tiny(state.face) && state.opacity === '1' && state.score === '12,480', JSON.stringify(state));
  await ctx3.close();

  // ── report ──
  let failed = 0;
  for (const r of results) {
    if (!r.pass) failed++;
    console.log((r.pass ? '  ok    ' : '  FAIL  ') + r.name + (r.pass || !r.detail ? '' : '\n          ' + r.detail));
  }
  console.log('checks: ' + (results.length - failed) + '/' + results.length + ' passed');
  return failed === 0;
}

async function main() {
  const mode = process.argv[2] === 'shots' || process.argv[2] === 'check' ? process.argv[2] : 'all';
  const filter = mode === 'shots' ? process.argv[3] || '' : '';
  const server = await ensureServer();
  const browser = await chromium.launch();
  const problems = [];
  let pass = true;
  try {
    if (mode !== 'check') await shots(browser, filter, problems);
    if (mode !== 'shots') pass = await checks(browser, problems);
  } finally {
    await browser.close();
    if (server) server.kill();
  }
  const unique = Array.from(new Set(problems));
  if (unique.length) {
    pass = false;
    console.log('page problems:\n  ' + unique.slice(0, 20).join('\n  '));
  }
  if (!pass) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
