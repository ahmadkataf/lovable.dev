/**
 * Shared Playwright helpers for the play screen (used by tests/e2e/play.cjs and
 * tools/play-shots.cjs). They drive the dev harness play-demo.html with REAL pointer events.
 *
 * Other people edit this working tree while tests run, and Vite's dev client would reload the page
 * under the test whenever any module changes. So the page gets a tiny stand-in for `/@vite/client`
 * (styles are still injected, hot updates and reloads are not): a run sees one consistent page.
 */
const BASE = process.env.PLAY_URL || 'http://127.0.0.1:5184/play-demo.html';

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
 * Open the harness. `problems` collects console errors, console warnings (the play screen warns
 * when the board on screen had to be snapped to the engine), page errors and unhandled rejections.
 */
async function openHarness(browser, opts) {
  const { w, h, query = '', lang = 'en', problems = [], tag = '', mute = true, touch = false } = opts;
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: opts.dpr || 2, hasTouch: touch });
  const page = await context.newPage();
  await page.route('**/@vite/client', (route) => route.fulfill({ contentType: 'application/javascript', body: VITE_CLIENT_STUB }));
  page.on('console', (m) => {
    const type = m.type();
    if (type === 'error' || type === 'warning') problems.push(`${tag} console.${type}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`${tag} pageerror: ${e.message}`));
  await page.addInitScript(() => {
    window.addEventListener('unhandledrejection', (ev) => console.error('unhandledrejection: ' + (ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason))));
  });
  await page.goto(`${BASE}?lang=${lang}${mute ? '&mute=1' : ''}&${query}`);
  await page.waitForFunction(() => window.__demo && window.__demo.ready, null, { timeout: 30000 });
  return page;
}

/** Waiting for the player's move, with no dialog on screen (a closing dialog still swallows taps while it fades). */
const idle = (page, timeout = 30000) => page.waitForFunction(() => window.__play.isIdle() && !document.querySelector('.k-overlay'), null, { timeout });
const settled = (page, timeout = 60000) => page.waitForFunction(() => window.__play.isIdle() || window.__play.state() !== 'play', null, { timeout });
const state = (page) => page.evaluate(() => window.__play.state());
const cell = (page, c, r) => page.evaluate(([cc, rr]) => window.__play.cell(cc, rr), [c, r]);
const freeze = (page, on) => page.evaluate((v) => window.__demo.pause(v), on);

/** A real drag from cell a to its neighbour b. */
async function swipe(page, a, b) {
  const pa = await cell(page, a.c, a.r);
  const pb = await cell(page, b.c, b.r);
  await page.mouse.move(pa.x, pa.y);
  await page.mouse.down();
  await page.mouse.move((pa.x * 2 + pb.x) / 3, (pa.y * 2 + pb.y) / 3, { steps: 2 });
  await page.mouse.move(pb.x, pb.y, { steps: 2 });
  await page.mouse.up();
}

/** A real tap on a cell. */
async function tapCell(page, c, r) {
  const p = await cell(page, c, r);
  await page.mouse.click(p.x, p.y);
}

/** Tap a, then tap its neighbour b. */
async function tapTap(page, a, b) {
  await tapCell(page, a.c, a.r);
  await page.waitForTimeout(60);
  await tapCell(page, b.c, b.r);
}

/**
 * Run `gesture` (a swipe, a tap …) that starts a turn and wait until that turn has been played to
 * the end — or the level left the 'play' state. Returns false when no turn happened in time.
 */
async function turn(page, gesture, timeout = 8000) {
  const before = await page.evaluate(() => window.__play.turns());
  await gesture();
  const done = await page
    .waitForFunction((t) => window.__play.turns() > t || window.__play.state() !== 'play', before, { timeout })
    .then(() => true, () => false);
  await settled(page);
  return done;
}

/**
 * Play the engine's hinted move with real pointer events until the level leaves the 'play' state
 * or `max` moves were made. Alternates swipes and tap-tap. Returns the number of moves made.
 */
async function playHints(page, max, each) {
  let made = 0;
  for (let i = 0; i < max; i++) {
    await settled(page);
    if ((await state(page)) !== 'play') break;
    const h = await page.evaluate(() => window.__play.hint());
    if (!h) break;
    const played = await turn(page, () => (i % 3 === 2 ? tapTap(page, h.a, h.b) : swipe(page, h.a, h.b)));
    if (!played) throw new Error('the hinted move ' + JSON.stringify(h) + ' did not start a turn');
    made++;
    if (each) await each(i);
  }
  return made;
}

module.exports = { BASE, openHarness, idle, settled, state, cell, freeze, swipe, tapCell, tapTap, turn, playHints };
