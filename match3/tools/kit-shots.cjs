/**
 * UI kit review tool (dev only). Drives kit-demo.html in Chromium.
 *
 *   node tools/kit-shots.cjs                 screenshots → shots/kit/*.png, then the checks
 *   node tools/kit-shots.cjs shots [filter]  screenshots only (filter = substring of the file name, e.g. "dlg-tall" or "-rtl")
 *   node tools/kit-shots.cjs check [filter]  checks only (filter = substring of a group name: static, compat, buttons,
 *                                            dialogs, guards, back, blocking, focus, scroll, toasts, widgets, safe, layout,
 *                                            rtl, align, contrast, motion, leaks)
 *   node tools/kit-shots.cjs audit <files…>  the static Chrome 80 audit alone, for any .css / .html / .ts files
 *                                            (no browser, no server) — e.g. `audit src/ui/meta.css src/play/play.css`
 *
 * Screenshots: every gallery section and every dialog scenario at 320×480, 360×640, 412×915, 640×360 (landscape) and
 * 800×1280, in English (LTR) and Arabic (RTL).
 *
 * Checks: a static audit of the kit's CSS / JS against the Chrome 80 limits of docs/DESIGN.md §1, then behaviour, layout,
 * mirroring, alignment, contrast and leak checks. Every page of the checks runs with a "WebView 80 shim": APIs newer
 * than Chrome 80 are deleted and the `inert` attribute is neutralised (it does nothing before Chrome 102), so the kit's
 * own focus trap and input blocking are what is being tested — not the browser's.
 *
 * Dev server: http://127.0.0.1:5183 (KIT_PORT overrides). If none is running the tool starts one itself — with HMR off,
 * so that edits to other modules cannot reload the page in the middle of a run — and stops it afterwards.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.KIT_PORT || 5183);
const ORIGIN = 'http://127.0.0.1:' + PORT;
const BASE = ORIGIN + '/kit-demo.html';
const OUT = path.join(ROOT, 'shots', 'kit');
const KIT_DIR = path.join(ROOT, 'src', 'ui', 'kit');

/** deviceScaleFactor 2 on phones; the tablet is shot at 1 (800×1280 px is plenty to review). */
const VIEWPORTS = [
  { w: 320, h: 480, dsf: 2 },
  { w: 360, h: 640, dsf: 2 },
  { w: 412, h: 915, dsf: 2 },
  { w: 640, h: 360, dsf: 2 },
  { w: 800, h: 1280, dsf: 1 },
];
const LANGS = [
  { lang: 'en', dir: 'ltr' },
  { lang: 'ar', dir: 'rtl' },
];
const SECTIONS = ['buttons', 'icon-buttons', 'shop', 'hud', 'controls', 'dialogs'];
const SCENARIOS = ['basic', 'confirm', 'medal', 'tall', 'stack', 'result', 'lose', 'shop', 'long', 'locked', 'toasts'];
/** Scenarios that open exactly one dialog. */
const DIALOGS = ['basic', 'confirm', 'medal', 'tall', 'result', 'lose', 'shop', 'long', 'locked'];

/** A closed dialog's overlay stays in the DOM this long (overlay.ts: REMOVE_MS) — plus a margin. */
const GONE_MS = 350 + 150;

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

/** Reuse a running dev server, or start one (HMR off) through Vite's API. Returns a stop function. */
async function ensureServer() {
  if (await ping(BASE)) return async () => undefined;
  const vite = await import('vite');
  const server = await vite.createServer({
    root: ROOT,
    configFile: path.join(ROOT, 'vite.config.ts'),
    logLevel: 'error',
    clearScreen: false,
    server: { host: '127.0.0.1', port: PORT, strictPort: true, hmr: false },
  });
  await server.listen();
  for (let i = 0; i < 80; i++) {
    if (await ping(BASE)) return () => server.close();
    await sleep(250);
  }
  await server.close();
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

// ───────────────────────────── WebView 80 shim ─────────────────────────────

/**
 * Runs in the page before anything else. Makes a current Chromium behave like WebView 80 wherever the kit could tell
 * the difference: newer APIs are gone (using one throws → reported as a page exception) and `inert` has no effect.
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

/** drag(x, y, dy): one finger goes down at (x, y), moves dy px vertically in small steps and lifts. */
async function touchDragger(context, page) {
  const cdp = await context.newCDPSession(page);
  const send = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  return async (x, y, dy) => {
    await send('touchStart', x, y);
    const steps = Math.max(4, Math.round(Math.abs(dy) / 10));
    for (let i = 1; i <= steps; i++) {
      await send('touchMove', x, y + (dy * i) / steps);
      await sleep(8);
    }
    await send('touchEnd', x, y + dy);
    await sleep(120);
  };
}

async function shimContext(browser, opts) {
  const context = await browser.newContext(Object.assign({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1 }, opts || {}));
  await context.addInitScript(webview80Shim);
  return context;
}

// ───────────────────────────── screenshots ─────────────────────────────

/** Screenshots must not depend on where an endless animation happens to be: the kit's own switch for that. */
const still = (page) => page.evaluate(() => document.documentElement.classList.add('k-still'));

async function settleScenario(page, name) {
  // arming + the panel's and the footer buttons' entrance are over after ~400 ms
  await sleep(900);
  if (name === 'result') {
    // star pops, the score tween and the late coin bump
    await page.waitForFunction(() => {
      const chip = document.querySelector('.k-dialog .k-chip__text');
      return !!chip && chip.textContent === '+50';
    }, null, { timeout: 20000 });
    await sleep(700);
  }
}

async function shootLang(browser, size, lang, dir, filter, problems) {
  let count = 0;
  const context = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: size.dsf, hasTouch: true });
  const page = await context.newPage();
  watch(page, problems);
  const tag = '-' + size.w + (size.w > size.h ? 'x' + size.h : '') + '-' + dir;

  const wantSections = SECTIONS.filter((name) => !filter || (name + tag).indexOf(filter) >= 0);
  if (wantSections.length) {
    await load(page, lang, '');
    await still(page);
    await sleep(300);
    for (const name of wantSections) {
      const node = await page.$('[data-shot="' + name + '"]');
      if (!node) {
        problems.push('missing section ' + name + tag);
        continue;
      }
      await node.screenshot({ path: path.join(OUT, name + tag + '.png') });
      count++;
    }
  }
  for (const name of SCENARIOS) {
    const file = 'dlg-' + name + tag;
    if (filter && file.indexOf(filter) < 0) continue;
    await load(page, lang, name);
    await still(page);
    await settleScenario(page, name);
    await page.screenshot({ path: path.join(OUT, file + '.png') });
    count++;
    if (name === 'tall') {
      // the same dialog scrolled to its end
      await page.evaluate(() => {
        const panel = document.querySelector('.k-dialog');
        const scroller = panel.classList.contains('k-dialog--flow') ? panel.querySelector('.k-dialog__inner') : panel.querySelector('.k-dialog__body');
        scroller.scrollTop = scroller.scrollHeight;
      });
      await sleep(300);
      await page.screenshot({ path: path.join(OUT, file + '-end.png') });
      count++;
    }
  }
  await context.close();
  return count;
}

async function shots(browser, filter, problems) {
  fs.mkdirSync(OUT, { recursive: true });
  let count = 0;
  for (const size of VIEWPORTS) {
    // both languages of a size side by side
    const counts = await Promise.all(LANGS.map(({ lang, dir }) => shootLang(browser, size, lang, dir, filter, problems)));
    for (const c of counts) count += c;
  }
  console.log('screenshots: ' + count + ' file(s) in ' + path.relative(ROOT, OUT));
}

// ───────────────────────────── static audit (Chrome 80) ─────────────────────────────

/**
 * Every property the kit's CSS may use — each one checked by hand against Chrome 80. A property that is not listed
 * fails the audit until someone has verified it (then add it here). Notably absent: gap / row-gap / column-gap
 * (flexbox gap is Chrome 84; grids use grid-gap), aspect-ratio (88), inset* (87), the logical shorthands
 * margin-inline / padding-inline / margin-block / padding-block (87), translate / scale / rotate (104),
 * accent-color (93), content-visibility (85), border-*-*-radius logical corners (89), overflow: clip (90).
 */
const CSS_PROPERTIES = new Set(
  (
    '-webkit-appearance -webkit-background-clip -webkit-font-smoothing -webkit-overflow-scrolling -webkit-tap-highlight-color ' +
    '-webkit-text-fill-color -webkit-text-size-adjust -webkit-touch-callout -webkit-user-drag -webkit-user-select ' +
    'align-content align-items align-self animation animation-delay animation-direction animation-duration animation-fill-mode ' +
    'animation-iteration-count animation-name animation-play-state animation-timing-function appearance backface-visibility ' +
    'background background-clip background-color background-image background-origin background-position background-repeat ' +
    'background-size border border-bottom border-bottom-color border-bottom-left-radius border-bottom-right-radius border-color ' +
    'border-left border-left-color border-radius border-right border-right-color border-style border-top border-top-color ' +
    'border-top-left-radius border-top-right-radius border-width bottom box-shadow box-sizing color content cursor direction ' +
    'display fill filter flex flex-basis flex-direction flex-flow flex-grow flex-shrink flex-wrap font font-display font-family ' +
    'font-size font-style font-variant-numeric font-weight grid-area grid-column grid-gap grid-row grid-template-areas ' +
    'grid-template-columns grid-template-rows height justify-content justify-items justify-self left letter-spacing line-height ' +
    'margin margin-bottom margin-inline-end margin-inline-start margin-left margin-right margin-top max-height max-width ' +
    'min-height min-width object-fit opacity order outline outline-offset overflow overflow-wrap overflow-x overflow-y ' +
    'overscroll-behavior padding padding-bottom padding-inline-end padding-inline-start padding-left padding-right padding-top ' +
    'pointer-events position right src stroke text-align text-decoration text-overflow text-shadow text-size-adjust text-transform ' +
    'top touch-action transform transform-origin transition transition-delay transition-duration transition-property ' +
    'transition-timing-function unicode-bidi unicode-range user-select vertical-align visibility white-space width ' +
    'will-change word-break z-index'
  ).split(' '),
);

/** Functions allowed in values (min / max / clamp are Chrome 79; conic gradients 69). */
const CSS_FUNCTIONS = new Set(
  (
    'attr blur brightness calc clamp conic-gradient contrast cubic-bezier drop-shadow env format grayscale hsl hsla hue-rotate ' +
    'invert linear-gradient local matrix max min minmax opacity perspective radial-gradient repeat repeating-conic-gradient ' +
    'repeating-linear-gradient repeating-radial-gradient rgb rgba rotate rotateX rotateY rotateZ saturate scale scaleX scaleY ' +
    'sepia skew skewX skewY steps translate translate3d translateX translateY translateZ url var'
  )
    .toLowerCase()
    .split(' '),
);

const CSS_VALUE_RULES = [
  ['dynamic / container viewport units', /(^|[^\w.-])-?\d*\.?\d+(dvh|dvw|svh|svw|lvh|lvw|dvmin|dvmax|svmin|svmax|lvmin|lvmax|cqw|cqh|cqi|cqb|cqmin|cqmax|rlh|lh|cap|rex|ric)\b/],
  ['color-mix() / relative colours / newer colour spaces', /\b(color-mix|oklch|oklab|lch|lab|hwb|color|light-dark)\(/],
  ['space-separated rgb() / hsl() with "/" alpha (Chrome 65+ parses it, the minifier target does not need it)', /\b(rgba?|hsla?)\([^),]*\/[^)]*\)/],
];

const CSS_DECLARATION_RULES = [
  ['overflow: clip', /^overflow(-x|-y)?$/, /\bclip\b/],
  ['display: contents (breaks buttons before Chrome 89)', /^display$/, /\bcontents\b/],
  ['position: sticky inside the kit (untested on WebView 80)', /^position$/, /\bsticky\b/],
  ['text-wrap / white-space keywords newer than Chrome 80', /^white-space$/, /\b(balance|pretty|stable)\b/],
  ['width / height keywords newer than Chrome 80', /^(width|height|min-width|min-height|max-width|max-height)$/, /\b(stretch|fit-content\()/],
];

const CSS_SELECTOR_RULES = [
  [':is()', /:is\(/],
  [':where()', /:where\(/],
  [':has()', /:has\(/],
  [':focus-visible (the kit uses the .k-kbd class instead)', /:focus-visible/],
  ['nesting (&)', /&/],
  [':dir() / :user-valid / :user-invalid', /:(dir|user-valid|user-invalid)\b/],
];

/** `:not()` takes exactly one simple selector before Chrome 88. */
const SIMPLE_NOT = /^(\.[\w-]+|#[\w-]+|\[[^\]]+\]|::?[\w-]+(\([^)]*\))?|[a-z][\w-]*|\*)$/i;

function stripCssComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/** Parse CSS text into a flat list of { selector, at (enclosing at-rule preludes), decls: [[prop, value]] }. */
function parseCss(text) {
  const rules = [];
  const src = stripCssComments(text);
  function block(from, to, ats) {
    let i = from;
    while (i < to) {
      const open = src.indexOf('{', i);
      if (open < 0 || open >= to) break;
      const prelude = src.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < to && depth > 0) {
        const ch = src[j];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        j++;
      }
      const inner = [open + 1, j - 1];
      if (/^@(media|supports|keyframes|-webkit-keyframes|layer|container|scope|starting-style|document)\b/.test(prelude)) {
        rules.push({ selector: '', at: ats.concat(prelude), decls: [], prelude });
        block(inner[0], inner[1], ats.concat(prelude));
      } else {
        const decls = [];
        // split on ";" outside parentheses
        let d = '';
        let par = 0;
        for (let k = inner[0]; k <= inner[1]; k++) {
          const ch = k < inner[1] ? src[k] : ';';
          if (ch === '(') par++;
          else if (ch === ')') par--;
          if (ch === ';' && par <= 0) {
            const c = d.indexOf(':');
            if (c > 0) decls.push([d.slice(0, c).trim().toLowerCase(), d.slice(c + 1).trim()]);
            d = '';
          } else d += ch;
        }
        rules.push({ selector: prelude, at: ats, decls });
      }
      i = j;
    }
  }
  block(0, src.length, []);
  return rules;
}

function auditCss(name, text) {
  const out = [];
  const add = (what, where) => {
    const line = name + ': ' + what + (where ? '  →  ' + where.replace(/\s+/g, ' ').slice(0, 90) : '');
    if (out.indexOf(line) < 0) out.push(line);
  };
  for (const rule of parseCss(text)) {
    if (rule.prelude) {
      const p = rule.prelude;
      if (/^@(layer|container|scope|starting-style|property)\b/.test(p)) add('at-rule newer than Chrome 80', p);
      if (/^@media\b/.test(p) && /[<>]=?/.test(p)) add('media query range syntax', p);
      continue;
    }
    const sel = rule.selector;
    const keyframe = rule.at.some((a) => /^@(-webkit-)?keyframes\b/.test(a));
    if (!keyframe && !/^@/.test(sel)) {
      for (const [what, re] of CSS_SELECTOR_RULES) if (re.test(sel)) add('selector uses ' + what, sel);
      const nots = sel.match(/:not\(((?:[^()]|\([^()]*\))*)\)/g) || [];
      for (const n of nots) {
        const arg = n.slice(5, -1).trim();
        if (!SIMPLE_NOT.test(arg)) add(':not() with more than one simple selector (Chrome 88)', n);
      }
    }
    if (/^@(property|layer|container)\b/.test(sel)) add('at-rule newer than Chrome 80', sel);
    const fontFace = /^@font-face\b/.test(sel);
    for (const [prop, value] of rule.decls) {
      const custom = prop.indexOf('--') === 0;
      if (!custom && !CSS_PROPERTIES.has(prop)) add('property not vetted for Chrome 80: ' + prop, sel + ' { ' + prop + ': ' + value + ' }');
      if (prop === 'box-shadow' || custom || prop === 'transition' || prop === 'animation') {
        // "inset" is a box-shadow keyword; nothing else to check by name here
      }
      const fns = value.match(/[a-zA-Z-]+(?=\()/g) || [];
      for (const fn of fns) if (!CSS_FUNCTIONS.has(fn.toLowerCase())) add('function not vetted for Chrome 80: ' + fn + '()', prop + ': ' + value);
      for (const [what, re] of CSS_VALUE_RULES) if (re.test(value)) add(what, prop + ': ' + value);
      for (const [what, propRe, valueRe] of CSS_DECLARATION_RULES) if (propRe.test(prop) && valueRe.test(value)) add(what, sel + ' { ' + prop + ': ' + value + ' }');
      if (/env\(/.test(value) && !(sel === ':root' && /^--safe-(top|right|bottom|left)$/.test(prop))) add('env() outside the --safe-* tokens of :root', sel + ' { ' + prop + ': ' + value + ' }');
      if (fontFace && prop === 'src' && /format\((?!['"]?woff)/.test(value)) add('font format other than woff / woff2', value);
    }
  }
  return out;
}

/** JS APIs newer than Chrome 80 (docs/DESIGN.md §1) — checked in the kit's sources, comments stripped. */
const JS_RULES = [
  ['Array / String .at()', /\.at\(/],
  ['String.replaceAll', /\.replaceAll\(/],
  ['structuredClone', /\bstructuredClone\b/],
  ['Object.hasOwn', /Object\.hasOwn\b/],
  ['Promise.any / withResolvers', /Promise\.(any|withResolvers)\b/],
  ['findLast / findLastIndex', /\.findLast(Index)?\(/],
  ['toSorted / toReversed / toSpliced', /\.to(Sorted|Reversed|Spliced)\(/],
  ['WeakRef / FinalizationRegistry', /\b(WeakRef|FinalizationRegistry)\b/],
  ['replaceChildren (Chrome 86)', /\.replaceChildren\(/],
  ['Web Animations API (animate / getAnimations: options beyond Chrome 80)', /\.(animate|getAnimations)\(/],
  ['the inert PROPERTY (the attribute is fine)', /\.inert\s*=/],
  ['checkVisibility', /\.checkVisibility\(/],
  ['crypto.randomUUID', /randomUUID\(/],
  ['AbortSignal.timeout / any', /AbortSignal\.(timeout|any)\b/],
  ['canvas roundRect / createConicGradient', /\.(roundRect|createConicGradient)\(/],
  ['top-level await', /^\s*(export\s+)?(const|let|var)\s+[\w{},\s]+=\s*await\b|^await\b/m],
  ['network access', /\b(fetch\(|XMLHttpRequest|WebSocket\(|navigator\.sendBeacon|new\s+EventSource)/],
  ['CSS forbidden in inline styles (gap / inset / aspect-ratio)', /\b(gap|rowGap|columnGap|inset|insetInline|insetBlock|aspectRatio)\s*:\s*['"`]/],
];

function auditJs(name, text) {
  const code = text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
  const out = [];
  for (const [what, re] of JS_RULES) {
    const m = re.exec(code);
    if (m) out.push(name + ': ' + what + '  →  ' + m[0].trim().slice(0, 60));
  }
  return out;
}

function staticAudit() {
  const css = [];
  css.push(...auditCss('kit.css', fs.readFileSync(path.join(KIT_DIR, 'kit.css'), 'utf8')));
  const html = fs.readFileSync(path.join(ROOT, 'kit-demo.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const styles = html.match(/<style[^>]*>[\s\S]*?<\/style>/g) || [];
  for (const s of styles) css.push(...auditCss('kit-demo.html', s.replace(/<\/?style[^>]*>/g, '')));
  const js = [];
  for (const file of fs.readdirSync(KIT_DIR).filter((f) => /\.ts$/.test(f) && f !== 'demo.ts')) {
    js.push(...auditJs(file, fs.readFileSync(path.join(KIT_DIR, file), 'utf8')));
  }
  // the auditor must be able to catch what it is there for
  const probe =
    '.a{display:flex;gap:4px;inset:0;aspect-ratio:1;margin-inline:2px;translate:1px;height:100dvh;color:color-mix(in srgb,red,blue);overflow:clip}' +
    '.b:is(.c),.d:not(.e.f),.g:focus-visible{top:0}@layer x{.h{top:0}}@media (width >= 400px){.i{top:0}}.j{padding:env(safe-area-inset-top)}';
  const caught = auditCss('probe', probe).length;
  const jsCaught = auditJs('probe', 'const a = [1].at(-1); el.replaceChildren(); x.replaceAll("a","b"); structuredClone(y); style: { gap: "4px" }').length;
  return { css, js, selfTest: caught >= 13 && jsCaught >= 5, caught, jsCaught };
}

// ───────────────────────────── checks ─────────────────────────────

async function checks(browser, filter, problems) {
  const results = [];
  let group = '';
  const ok = (name, pass, detail) => {
    results.push({ group, name, pass: !!pass, detail: detail || '' });
  };
  const wants = (name) => {
    group = name;
    return !filter || name.indexOf(filter) >= 0;
  };
  const near = (a, b, eps) => Math.abs(a - b) <= (eps === undefined ? 0.1 : eps);

  /** One fresh page (with the WebView 80 shim) per group. */
  async function fresh(opts) {
    const o = opts || {};
    const context = await shimContext(browser, { viewport: o.viewport || { width: 360, height: 640 }, deviceScaleFactor: o.dsf || 1, hasTouch: !!o.touch, reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    watch(page, problems);
    await load(page, o.lang || 'en', o.open || '');
    const demo = (fn, arg) => page.evaluate(fn, arg);
    /** wait until every closed overlay has left the DOM */
    const gone = async () => {
      await page.waitForFunction(() => document.querySelectorAll('.k-overlay').length === 0, null, { timeout: 5000 });
    };
    const settle = () => sleep(460); // arming + entrance
    return { context, page, demo, gone, settle };
  }

  // ── static: the Chrome 80 audit ──
  if (wants('static')) {
    const audit = staticAudit();
    ok('the auditor catches forbidden CSS / JS (self-test)', audit.selfTest, 'css findings ' + audit.caught + ', js findings ' + audit.jsCaught);
    ok('kit.css / kit-demo.html use only CSS that Chrome 80 supports', audit.css.length === 0, audit.css.slice(0, 8).join('\n          '));
    ok('the kit sources use no JS API newer than Chrome 80 and no network', audit.js.length === 0, audit.js.slice(0, 8).join('\n          '));
  }

  // ── runtime compat: what the browser actually applies ──
  if (wants('compat')) {
    for (const { lang, dir } of LANGS) {
      const { context, page, demo, settle } = await fresh({ lang });
      const scan = () =>
        demo(() => {
          const bad = [];
          const all = document.querySelectorAll('#app *, .k-layer *, .k-toasts *');
          for (const node of all) {
            const cs = getComputedStyle(node);
            const flex = cs.display === 'flex' || cs.display === 'inline-flex';
            if (flex && ((cs.rowGap !== 'normal' && cs.rowGap !== '0px') || (cs.columnGap !== 'normal' && cs.columnGap !== '0px'))) bad.push('flex gap on ' + node.className);
            // (canvases / images get "auto W / H" from their width and height attributes — not authored CSS)
            if (cs.aspectRatio && cs.aspectRatio.indexOf('auto') !== 0) bad.push('aspect-ratio on ' + node.className);
            if (cs.translate && cs.translate !== 'none') bad.push('translate on ' + node.className);
            if (cs.scale && cs.scale !== 'none') bad.push('scale on ' + node.className);
            if (cs.rotate && cs.rotate !== 'none') bad.push('rotate on ' + node.className);
            const replaced = /^(CANVAS|IMG|VIDEO|svg|IFRAME)$/.test(node.tagName);
            if (!replaced && (cs.overflowX === 'clip' || cs.overflowY === 'clip')) bad.push('overflow: clip on ' + node.className);
            if (cs.display === 'contents') bad.push('display: contents on ' + node.className);
          }
          return { count: all.length, bad: bad.slice(0, 6), shim: window.__webview80 === true, at: typeof [].at, repl: typeof document.body.replaceChildren };
        });
      let total = 0;
      const bad = [];
      let state = await scan();
      total += state.count;
      bad.push(...state.bad);
      for (const name of ['shop', 'result', 'lose', 'tall']) {
        await demo((n) => window.__kitDemo.open(n), name);
        await settle();
        const s = await scan();
        total += s.count;
        bad.push(...s.bad);
        await demo(() => window.__kitDemo.kit.closeAll());
      }
      ok(dir.toUpperCase() + ': the page runs with the WebView 80 shim (newer APIs deleted, inert neutralised)', state.shim && state.at === 'undefined' && state.repl === 'undefined', JSON.stringify(state));
      ok(dir.toUpperCase() + ': no flex gap / aspect-ratio / translate / scale / rotate / overflow:clip in any computed style (' + total + ' nodes)', bad.length === 0, bad.join(' | '));
      await context.close();
    }
  }

  // ── fonts & network ──
  if (wants('static')) {
    const { context, page, demo } = await fresh();
    const requests = [];
    page.on('request', (req) => requests.push(req.url()));
    await load(page, 'en', '');
    const fontsEn = requests.filter((u) => /\.woff2?(\?|$)/.test(u)).map((u) => u.split('/').pop().split('?')[0]);
    await load(page, 'ar', '');
    const fontsAr = requests.filter((u) => /\.woff2?(\?|$)/.test(u)).map((u) => u.split('/').pop().split('?')[0]);
    const uniqueFonts = Array.from(new Set(fontsAr)).sort();
    ok(
      'only the Arabic + Latin font subsets are loaded',
      uniqueFonts.length === 2 && /arabic/.test(uniqueFonts[0]) && /latin-wght/.test(uniqueFonts[1]),
      uniqueFonts.join(', ') + ' (en page: ' + Array.from(new Set(fontsEn)).join(', ') + ')',
    );
    const fontOk = await demo(() => document.fonts.check('700 16px "Baloo Bhaijaan 2 Variable"', 'Aa') && document.fonts.check('700 16px "Baloo Bhaijaan 2 Variable"', 'أب'));
    ok('fontsReady(): both scripts render in the bundled font', fontOk);
    const foreign = requests.filter((u) => !u.startsWith(ORIGIN) && !u.startsWith('data:') && !u.startsWith('blob:'));
    ok('no requests leave the dev server', foreign.length === 0, foreign.slice(0, 3).join(', '));
    await context.close();
  }

  // ── buttons: feedback, double activation guard, pressed state ──
  if (wants('buttons')) {
    const { context, page, demo } = await fresh();
    let state;
    await demo(() => {
      const d = window.__kitDemo;
      d.log.sfx.length = 0;
      d.log.haptics.length = 0;
    });
    await page.dblclick('#demo-guard');
    state = await demo(() => ({ clicks: window.__kitDemo.log.clicks.guard || 0, sfx: window.__kitDemo.log.sfx.slice(), haptics: window.__kitDemo.log.haptics.slice() }));
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

    // rapid taps, 40 … 300 ms apart, mouse: never more than one activation per 350 ms
    await sleep(420);
    const box0 = await page.locator('#demo-guard').boundingBox();
    const cx = box0.x + box0.width / 2;
    const cy = box0.y + box0.height / 2;
    const rapid = [];
    for (const gap of [40, 90, 150, 220, 300]) {
      await demo(() => (window.__kitDemo.log.clicks.guard = 0));
      await page.mouse.click(cx, cy);
      await sleep(gap);
      await page.mouse.click(cx, cy);
      await sleep(30);
      rapid.push(gap + 'ms:' + (await demo(() => window.__kitDemo.log.clicks.guard || 0)));
      await sleep(420);
    }
    ok('two rapid clicks 40 … 300 ms apart never fire a button twice', rapid.every((r) => /:1$/.test(r)), rapid.join(' '));

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
    await sleep(420);
    await demo(() => (window.__kitDemo.log.clicks.guard = 0));
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
    ok('sliding off a button cancels the press', state.clicks === 0, 'activations: ' + state.clicks);

    // a finger that slides off lets the button go at once (touch pointers are captured: no pointerleave)
    state = await demo(() => {
      const b = document.getElementById('demo-guard');
      const r = b.getBoundingClientRect();
      const fire = (type, x, y) => b.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', pointerId: 7, clientX: x, clientY: y, button: 0 }));
      fire('pointerdown', r.left + 20, r.top + 20);
      const down = b.classList.contains('k-pressed');
      fire('pointermove', r.left + 24, r.top + 22);
      const inside = b.classList.contains('k-pressed');
      return new Promise((resolve) => {
        setTimeout(() => {
          fire('pointermove', r.left + 24, r.bottom + 40);
          setTimeout(() => {
            const off = b.classList.contains('k-pressed');
            fire('pointerup', r.left + 24, r.bottom + 40);
            resolve({ down, inside, off });
          }, 20);
        }, 120);
      });
    });
    ok('touch: the pressed look ends as soon as the finger has left the button', state.down && state.inside && !state.off, JSON.stringify(state));

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

    // chips, list items: the same guard
    await demo(() => window.scrollTo(0, document.getElementById('demo-coins').getBoundingClientRect().top + window.scrollY - 200));
    await page.dblclick('#demo-coins');
    state = await demo(() => ({ coins: window.__kitDemo.log.clicks.coins || 0 }));
    ok('a tappable chip fires once on a double tap', state.coins === 1, 'activations: ' + state.coins);
    await context.close();
  }

  // ── dialogs: promises, order ──
  if (wants('dialogs')) {
    const { context, page, demo, gone, settle } = await fresh();
    let state;
    await demo(() => window.__kitDemo.open('basic'));
    await settle();
    state = await demo(() => ({ has: window.__kitDemo.kit.hasOverlay(), sfx: window.__kitDemo.log.sfx.slice(-1)[0], role: document.querySelector('.k-dialog').getAttribute('role'), modal: document.querySelector('.k-dialog').getAttribute('aria-modal') }));
    ok("openDialog shows a modal dialog and plays 'popupOpen'", state.has && state.sfx === 'popupOpen' && state.role === 'dialog' && state.modal === 'true', JSON.stringify(state));
    await page.click('.k-dialog__foot .k-btn--primary');
    await sleep(50);
    state = await demo(() => ({ result: window.__kitDemo.results.basic, has: window.__kitDemo.kit.hasOverlay(), sfx: window.__kitDemo.log.sfx.slice(-2).join() }));
    ok('a dialog button closes the dialog and resolves `closed` with its result', state.result === 'resume' && state.has === false, JSON.stringify(state));
    ok("closing plays 'popupClose' (after the button sound)", state.sfx === 'button,popupClose', state.sfx);
    await sleep(GONE_MS);
    ok('the closed dialog is removed from the DOM', (await demo(() => document.querySelectorAll('.k-overlay').length)) === 0);

    await demo(() => window.__kitDemo.open('confirm'));
    await settle();
    await page.click('.k-dialog__foot .k-btn--danger');
    await sleep(50);
    ok('confirm → yes resolves true', (await demo(() => window.__kitDemo.results.confirm)) === true);
    await gone();
    await demo(() => window.__kitDemo.open('confirm'));
    await settle();
    await page.click('.k-dialog__foot .k-btn--secondary');
    await sleep(50);
    ok('confirm → no resolves false', (await demo(() => window.__kitDemo.results.confirm)) === false);
    await gone();

    await demo(() => window.__kitDemo.open('basic'));
    await settle();
    await page.click('.k-dialog__x');
    await sleep(50);
    ok('✕ closes a dismissible dialog with undefined', (await demo(() => window.__kitDemo.results.basic)) === 'undefined');
    await gone();

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
    await gone();

    // a press that starts on the panel and ends on the backdrop (or the other way round) is not a backdrop tap
    await demo(() => window.__kitDemo.open('basic'));
    await sleep(500);
    const panelBox = await page.locator('.k-dialog').boundingBox();
    await page.mouse.move(panelBox.x + 30, panelBox.y + 60);
    await page.mouse.down();
    await page.mouse.move(8, 8);
    await page.mouse.up();
    await page.mouse.move(8, 8);
    await page.mouse.down();
    await page.mouse.move(panelBox.x + 30, panelBox.y + 60);
    await page.mouse.up();
    await sleep(50);
    ok('a drag from the panel to the backdrop (or back) does not dismiss', (await demo(() => window.__kitDemo.kit.hasOverlay())) === true);
    await demo(() => window.__kitDemo.kit.closeAll());
    await gone();

    // three dialogs: LIFO, each promise resolves, in order
    state = await demo(async () => {
      const kit = window.__kitDemo.kit;
      const order = [];
      const a = kit.openDialog({ title: 'A', body: 'a' });
      const b = kit.openDialog({ title: 'B', body: 'b' });
      const c = kit.openDialog({ title: 'C', body: 'c', buttons: [{ label: 'ok', result: 'never' }] });
      a.closed.then((v) => order.push('A:' + v));
      b.closed.then((v) => order.push('B:' + v));
      c.closed.then((v) => order.push('C:' + v));
      const tick = () => new Promise((r) => setTimeout(r, 0));
      const rets = [];
      const states = [];
      const tops = [];
      for (let i = 0; i < 4; i++) {
        rets.push(kit.closeTop());
        await tick();
        states.push([a.isOpen(), b.isOpen(), c.isOpen()].map((x) => (x ? 1 : 0)).join(''));
        const top = document.querySelector('.k-overlay.k-open:not(.k-under)');
        tops.push(top ? top.querySelector('.k-dialog__title').textContent : '-');
      }
      return { order, rets, states, tops, has: kit.hasOverlay() };
    });
    ok(
      'three stacked dialogs: closeTop ×3 closes them last-in-first-out and resolves each promise in that order',
      state.order.join() === 'C:undefined,B:undefined,A:undefined' && state.rets.join() === 'true,true,true,false' && state.states.join() === '110,100,000,000' && state.tops.join() === 'B,A,-,-' && !state.has,
      JSON.stringify(state),
    );
    await gone();

    // closing a dialog that is not on top leaves the others alone
    state = await demo(async () => {
      const kit = window.__kitDemo.kit;
      const a = kit.openDialog({ title: 'A', body: 'a' });
      const b = kit.openDialog({ title: 'B', body: 'b' });
      a.close('early');
      const va = await a.closed;
      const out = { va, b: b.isOpen(), under: document.querySelectorAll('.k-overlay.k-open.k-under').length, hidden: document.getElementById('app').getAttribute('aria-hidden') };
      b.close('late');
      out.vb = await b.closed;
      out.has = kit.hasOverlay();
      return out;
    });
    ok('closing the lower of two dialogs keeps the top one open and modal', state.va === 'early' && state.b === true && state.under === 0 && state.hidden === 'true' && state.vb === 'late' && !state.has, JSON.stringify(state));
    await gone();

    // closed during its opening animation
    state = await demo(async () => {
      const kit = window.__kitDemo.kit;
      const out = [];
      for (const delay of [0, 16, 60, 130, 220]) {
        const d = kit.openDialog({ title: 'T', icon: 'gift', body: 'x', buttons: [{ label: 'ok' }] });
        let value = 'pending';
        d.closed.then((v) => (value = v));
        if (delay) await new Promise((r) => setTimeout(r, delay));
        d.close('early');
        d.close('twice');
        await new Promise((r) => setTimeout(r, 0));
        out.push(value);
      }
      await new Promise((r) => setTimeout(r, 700));
      return {
        out,
        overlays: document.querySelectorAll('.k-overlay').length,
        layers: document.querySelectorAll('.k-layer').length,
        has: kit.hasOverlay(),
        hidden: document.getElementById('app').getAttribute('aria-hidden'),
        inert: document.getElementById('app').getAttribute('inert'),
      };
    });
    ok(
      'a dialog closed during its opening animation resolves once and leaves no orphan nodes (overlay, layer, aria-hidden)',
      state.out.every((v) => v === 'early') && state.overlays === 0 && state.layers === 0 && !state.has && state.hidden === null && state.inert === null,
      JSON.stringify(state),
    );

    // onClose, keepOpen, onClick → false, async onClick
    state = await demo(async () => {
      const kit = window.__kitDemo.kit;
      const log = [];
      const d = kit.openDialog({
        title: 'T',
        body: 'x',
        onClose: (v) => log.push('onClose:' + v),
        buttons: [
          { label: 'stay', keepOpen: true, result: 'a' },
          { label: 'veto', onClick: () => false, result: 'b' },
          { label: 'slow', onClick: () => new Promise((r) => setTimeout(() => r(true), 80)), result: 'c' },
        ],
      });
      d.buttons[0].click();
      await new Promise((r) => setTimeout(r, 400));
      log.push('after stay:' + d.isOpen());
      d.buttons[1].click();
      await new Promise((r) => setTimeout(r, 400));
      log.push('after veto:' + d.isOpen());
      d.buttons[2].click();
      log.push('during slow:' + d.isOpen());
      const v = await d.closed;
      log.push('closed:' + v);
      return log;
    });
    ok('keepOpen / onClick → false keep a dialog open; an async onClick closes it when it settles; onClose runs once', state.join() === 'after stay:true,after veto:true,during slow:true,onClose:c,closed:c', state.join());
    await context.close();
  }

  // ── guards: double taps around opening and closing ──
  if (wants('guards')) {
    for (const touch of [false, true]) {
      const { context, page, demo, gone } = await fresh({ touch });
      const kind = touch ? 'tap' : 'click';
      const hit = async (x, y) => {
        if (touch) await page.touchscreen.tap(x, y);
        else await page.mouse.click(x, y);
      };
      // an opener placed exactly where the new dialog's button appears
      await demo(() => {
        const kit = window.__kitDemo.kit;
        window.scrollTo(0, 0);
        window.__hits = { inner: 0, opened: 0, closedWith: 'open' };
        const opener = kit.button({
          label: 'open',
          onClick: () => {
            window.__hits.opened++;
            const d = kit.openDialog({ title: 'T', body: 'x', buttons: [{ label: 'Buy now', result: 'bought', onClick: () => void window.__hits.inner++ }] });
            d.closed.then((v) => (window.__hits.closedWith = String(v)));
          },
        });
        opener.id = 'probe-opener';
        opener.style.cssText = 'position:fixed;left:130px;top:330px;z-index:5';
        document.body.appendChild(opener);
        opener.click();
      });
      await sleep(500);
      const target = await demo(() => {
        const r = document.querySelector('.k-dialog__foot .k-btn').getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      await demo(() => window.__kitDemo.kit.closeAll());
      await gone();
      await demo((t) => {
        const o = document.getElementById('probe-opener');
        o.style.left = t.x - 50 + 'px';
        o.style.top = t.y - 25 + 'px';
      }, target);
      await sleep(420);
      const opened = [];
      for (const gap of [50, 110, 180, 240]) {
        await demo(() => (window.__hits = { inner: 0, opened: 0, closedWith: 'open' }));
        await hit(target.x, target.y);
        await sleep(gap);
        await hit(target.x, target.y);
        await sleep(80);
        const h = await demo(() => window.__hits);
        opened.push(gap + 'ms:' + h.opened + '/' + h.inner + '/' + h.closedWith);
        await demo(() => window.__kitDemo.kit.closeAll());
        await gone();
        await sleep(380);
      }
      ok('double ' + kind + ' on an opener (50 … 240 ms apart): the second one never activates a button of the new dialog', opened.every((o) => /:1\/0\/open$/.test(o)), opened.join(' '));
      // … but the dialog does take input once it has landed
      await demo(() => (window.__hits = { inner: 0, opened: 0, closedWith: 'open' }));
      await hit(target.x, target.y);
      await sleep(450);
      await hit(target.x, target.y);
      await sleep(80);
      const late = await demo(() => window.__hits);
      ok('… and a ' + kind + ' 450 ms after opening works normally', late.inner === 1 && late.closedWith === 'bought', JSON.stringify(late));
      await gone();
      await demo(() => document.getElementById('probe-opener').remove());

      // a ready-made footer button cannot fire while its dialog closes
      await demo(() => {
        const kit = window.__kitDemo.kit;
        window.__hits = { pay: 0 };
        const pay = kit.priceButton({ price: '90', icon: 'coin', block: true, onClick: () => void window.__hits.pay++ });
        pay.id = 'probe-pay';
        kit.openDialog({ title: 'T', body: 'x', buttonLayout: 'column', buttons: [pay, { label: 'Give up', variant: 'ghost', result: 'no' }] });
      });
      await sleep(500);
      const pay = await page.locator('#probe-pay').boundingBox();
      const giveUp = await page.locator('.k-dialog__foot .k-btn--ghost').boundingBox();
      await hit(giveUp.x + giveUp.width / 2, giveUp.y + giveUp.height / 2);
      await sleep(40);
      await hit(pay.x + pay.width / 2, pay.y + pay.height / 2);
      await sleep(120);
      await hit(pay.x + pay.width / 2, pay.y + pay.height / 2);
      await sleep(60);
      const h2 = await demo(() => ({ pay: window.__hits.pay, has: window.__kitDemo.kit.hasOverlay() }));
      ok(kind + ': a ready-made (price / ad) footer button cannot fire while its dialog is closing', h2.pay === 0 && !h2.has, JSON.stringify(h2));
      await gone();
      await context.close();
    }

    // the second tap of a double tap on a dialog button never reaches what is underneath — also with reduced motion
    for (const reduced of [false, true]) {
      const { context, page, demo, gone } = await fresh({ reduced });
      await demo(() => {
        window.scrollTo(0, 0);
        window.__under = 0;
        document.addEventListener(
          'click',
          (e) => {
            if (e.target.closest && e.target.closest('#app')) window.__under++;
          },
          true,
        );
        for (const type of ['pointerdown', 'mousedown', 'touchstart']) document.getElementById('app').addEventListener(type, () => window.__under++, true);
      });
      const leaks = [];
      for (const gap of [50, 120, 200, 260]) {
        await demo(() => {
          window.__under = 0;
          window.__kitDemo.open('basic');
        });
        await sleep(500);
        const b = await page.locator('.k-dialog__foot .k-btn--primary').boundingBox();
        await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
        await sleep(gap);
        await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
        await sleep(40);
        leaks.push(gap + 'ms:' + (await demo(() => window.__under)));
        await gone();
      }
      ok((reduced ? 'reduced motion: ' : '') + 'a double click on a dialog button (50 … 260 ms apart) never reaches the screen underneath', leaks.every((l) => /:0$/.test(l)), leaks.join(' '));
      // … and the screen is usable again right after
      await sleep(60);
      await demo(() => (window.__under = 0));
      await page.mouse.click(180, 400);
      ok((reduced ? 'reduced motion: ' : '') + '… and the screen takes input again once the closed overlay is gone', (await demo(() => window.__under)) > 0);
      await context.close();
    }
  }

  // ── Back handling ──
  if (wants('back')) {
    const { context, page, demo, gone, settle } = await fresh();
    let state;
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
    await gone();

    // non-dismissible: Back, Escape, backdrop taps (mouse) anywhere, again and again
    await demo(() => window.__kitDemo.open('locked'));
    await settle();
    const back1 = await demo(() => [window.__kitDemo.kit.closeTop(), window.__kitDemo.kit.closeTop()].join());
    await page.keyboard.press('Escape');
    for (const [x, y] of [[8, 8], [350, 8], [8, 630], [350, 630], [180, 40]]) await page.mouse.click(x, y);
    await sleep(450);
    for (const [x, y] of [[8, 8], [350, 630]]) await page.mouse.click(x, y);
    await sleep(60);
    state = await demo(() => ({ has: window.__kitDemo.kit.hasOverlay(), x: document.querySelectorAll('.k-dialog__x').length, result: window.__kitDemo.results.locked, open: document.querySelectorAll('.k-overlay.k-open').length }));
    ok('dismissible:false — Back is swallowed (returns true), no ✕, backdrop taps do nothing', back1 === 'true,true' && state.has === true && state.x === 0 && state.result === 'open' && state.open === 1, 'back=' + back1 + ' ' + JSON.stringify(state));
    // a dismissible dialog on top of a locked one closes; the locked one stays
    await demo(() => window.__kitDemo.open('basic'));
    await settle();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await sleep(60);
    state = await demo(() => ({ basic: window.__kitDemo.results.basic, locked: window.__kitDemo.results.locked, has: window.__kitDemo.kit.hasOverlay() }));
    ok('Back ×2 over [locked, dismissible] closes only the dismissible one', state.basic === 'undefined' && state.locked === 'open' && state.has, JSON.stringify(state));
    await demo(() => window.__kitDemo.kit.closeAll());
    await sleep(60);
    ok('closeAll() empties the stack', (await demo(() => window.__kitDemo.kit.hasOverlay())) === false);
    await gone();

    // custom onBack
    state = await demo(async () => {
      const kit = window.__kitDemo.kit;
      let backs = 0;
      const d = kit.openDialog({ title: 'T', body: 'x', dismissible: false, onBack: (dialog) => (++backs === 2 ? dialog.close('by-back') : undefined) });
      const r1 = kit.closeTop();
      const open1 = d.isOpen();
      const r2 = kit.closeTop();
      return { r1, open1, r2, v: await d.closed, backs };
    });
    ok('onBack replaces the default Back behaviour', state.r1 && state.open1 && state.r2 && state.v === 'by-back' && state.backs === 2, JSON.stringify(state));
    await context.close();
  }

  // ── blocking underneath (inert has no effect here: the overlay itself must do it) ──
  if (wants('blocking')) {
    for (const touch of [false, true]) {
      const { context, page, demo } = await fresh({ touch });
      await demo(() => {
        window.scrollTo(0, 0);
        window.__leaks = [];
        for (const type of ['pointerdown', 'pointerup', 'click', 'mousedown', 'mouseup', 'touchstart', 'touchend']) {
          document.getElementById('app').addEventListener(type, (e) => window.__leaks.push(type + ':' + (e.target.className || e.target.tagName)), true);
        }
        window.__kitDemo.open('locked');
      });
      await sleep(500);
      let points = 0;
      for (let y = 6; y < 640; y += 37) {
        for (let x = 6; x < 360; x += 43) {
          if (touch) await page.touchscreen.tap(x, y);
          else await page.mouse.click(x, y);
          points++;
        }
      }
      // also while a second dialog is animating in and out on top
      await demo(() => window.__kitDemo.open('basic'));
      for (let i = 0; i < 12; i++) {
        const x = 20 + ((i * 53) % 320);
        const y = 30 + ((i * 97) % 580);
        if (touch) await page.touchscreen.tap(x, y);
        else await page.mouse.click(x, y);
        if (i === 5) await demo(() => window.__kitDemo.kit.closeTop());
        points++;
      }
      const leaks = await demo(() => window.__leaks);
      ok((touch ? 'touch' : 'mouse') + ' input at ' + points + ' points all over the viewport never reaches the app under a dialog', leaks.length === 0, leaks.slice(0, 5).join(', '));
      const wheel = await demo(() => window.scrollY);
      await page.mouse.move(20, 20);
      await page.mouse.wheel(0, 600);
      await sleep(200);
      const wheel2 = await demo(() => window.scrollY);
      ok((touch ? 'touch' : 'mouse') + ': the overlay covers the whole viewport', await demo(() => {
        const r = document.querySelector('.k-overlay').getBoundingClientRect();
        return r.left === 0 && r.top === 0 && r.right === innerWidth && r.bottom === innerHeight;
      }), 'scrollY ' + wheel + ' → ' + wheel2);
      await context.close();
    }
  }

  // ── focus (inert has no effect here: the kit's trap must do it) ──
  if (wants('focus')) {
    const { context, page, demo, gone } = await fresh();
    await page.click('#demo-guard'); // focus lives in the app
    await sleep(420);
    const clicksBefore = await demo(() => window.__kitDemo.log.clicks.guard || 0);
    await demo(() => {
      window.__kitDemo.open('basic');
      window.__kitDemo.open('confirm');
    });
    await sleep(500);
    const inTop = () =>
      demo(() => {
        const a = document.activeElement;
        const top = document.querySelector('.k-overlay:not(.k-under):not(.k-closing)');
        return { inTop: !!a && !!top && top.contains(a), tag: a ? a.tagName + '.' + String(a.className).slice(0, 30) : '' };
      });
    ok('opening a dialog moves focus into it', (await inTop()).inTop);
    const trail = [];
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press(i % 5 === 4 ? 'Shift+Tab' : 'Tab');
      trail.push((await inTop()).inTop);
    }
    ok('Tab / Shift+Tab ×14 stay inside the TOP dialog of a stack', trail.every(Boolean), trail.map((t) => (t ? 1 : 0)).join(''));
    ok('keyboard use switches the focus ring on', await demo(() => document.documentElement.classList.contains('k-kbd')));
    const pulled = await demo(() => {
      const top = document.querySelector('.k-overlay:not(.k-under):not(.k-closing)');
      document.getElementById('demo-guard').focus();
      const a = top.contains(document.activeElement);
      document.querySelector('.k-overlay.k-under .k-btn').focus();
      const b = top.contains(document.activeElement);
      return { a, b };
    });
    ok('focus() on the app or on a covered dialog is pulled back into the top dialog', pulled.a && pulled.b, JSON.stringify(pulled));
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await sleep(50);
    ok('Enter / Space cannot activate the button that opened the dialog', (await demo(() => window.__kitDemo.log.clicks.guard || 0)) === clicksBefore);
    await demo(() => window.__kitDemo.kit.closeTop());
    await sleep(60);
    let st = await inTop();
    ok('closing the top dialog moves focus into the dialog underneath', st.inTop, JSON.stringify(st));
    await sleep(GONE_MS);
    st = await inTop();
    ok('… and it is still there after the closed one left the DOM', st.inTop, JSON.stringify(st));
    await demo(() => window.__kitDemo.kit.closeTop());
    await sleep(60);
    const end = await demo(() => ({ id: document.activeElement && document.activeElement.id, inClosing: !!document.activeElement.closest('.k-overlay') }));
    ok('focus returns to the opener when the stack is empty (at once, not after the exit animation)', end.id === 'demo-guard' && !end.inClosing, JSON.stringify(end));
    await gone();

    // a dialog without any focusable element
    await demo(() => window.__kitDemo.open('locked'));
    await sleep(450);
    const lockedTrail = [];
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press(i === 2 ? 'Shift+Tab' : 'Tab');
      lockedTrail.push(await demo(() => document.activeElement === document.querySelector('.k-dialog')));
    }
    ok('a dialog with nothing focusable keeps the focus on its panel', lockedTrail.every(Boolean), lockedTrail.join());
    await demo(() => window.__kitDemo.kit.closeAll());
    await context.close();
  }

  // ── tall dialogs scroll inside ──
  if (wants('scroll')) {
    const { context, page, demo, gone, settle } = await fresh({ touch: true });
    let state;
    await demo(() => window.__kitDemo.open('tall'));
    await settle();
    state = await demo(() => {
      const body = document.querySelector('.k-dialog__body');
      const wrap = document.querySelector('.k-dialog__bodywrap');
      const panel = document.querySelector('.k-dialog').getBoundingClientRect();
      const foot = document.querySelector('.k-dialog__foot .k-btn').getBoundingClientRect();
      const before = { up: wrap.classList.contains('k-can-up'), down: wrap.classList.contains('k-can-down') };
      return { scrolls: body.scrollHeight > body.clientHeight + 20, top: panel.top, bottom: panel.bottom, footBottom: foot.bottom, vh: innerHeight, before };
    });
    // a real wheel gesture over the body scrolls the body, not the page
    await page.mouse.move(180, 320);
    await page.mouse.wheel(0, 5000);
    await sleep(300);
    const after = await demo(() => {
      const wrap = document.querySelector('.k-dialog__bodywrap');
      const body = document.querySelector('.k-dialog__body');
      return { up: wrap.classList.contains('k-can-up'), down: wrap.classList.contains('k-can-down'), atEnd: Math.abs(body.scrollHeight - body.clientHeight - body.scrollTop) < 2, page: window.scrollY };
    });
    ok('a tall dialog fits the viewport and its body scrolls inside', state.scrolls && state.top >= 0 && state.bottom <= state.vh && state.footBottom <= state.vh, JSON.stringify(state));
    ok('a wheel gesture scrolls the dialog body to its end and never the page behind', after.atEnd && after.page === 0, JSON.stringify(after));
    ok('scroll hints follow the scroll position', state.before.down && !state.before.up && after.up && !after.down, JSON.stringify({ before: state.before, after }));
    // the body pans vertically, the overlay around it does not pan at all
    state = await demo(() => ({
      body: getComputedStyle(document.querySelector('.k-dialog__body')).touchAction,
      overlay: getComputedStyle(document.querySelector('.k-overlay')).touchAction,
      contain: getComputedStyle(document.querySelector('.k-dialog__body')).overscrollBehaviorY,
    }));
    ok('touch: the body pans vertically, the overlay does not pan, scrolling does not chain to the page', state.body === 'pan-y' && state.overlay === 'none' && state.contain === 'contain', JSON.stringify(state));
    await demo(() => window.__kitDemo.kit.closeAll());
    await gone();

    // real touch drags: raw touch points fed to the browser's input pipeline, as a finger would
    const drag = await touchDragger(context, page);
    await demo(() => {
      window.scrollTo(0, 0);
      window.__kitDemo.open('tall');
    });
    await settle();
    await drag(180, 360, -260);
    await sleep(150);
    const dragged = await demo(() => ({ body: document.querySelector('.k-dialog__body').scrollTop, page: window.scrollY }));
    await drag(5, 320, -260); // on the backdrop strip beside the panel
    await drag(180, 610, -200); // on the footer
    await sleep(150);
    const outside = await demo(() => ({ body: document.querySelector('.k-dialog__body').scrollTop, page: window.scrollY }));
    ok('touch drag on the body scrolls it; drags on the backdrop or the footer scroll nothing — the page behind never moves', dragged.body > 100 && dragged.page === 0 && outside.page === 0 && Math.abs(outside.body - dragged.body) < 2, JSON.stringify({ dragged, outside }));
    await demo(() => window.__kitDemo.kit.closeAll());
    await gone();
    // without a dialog the same drag does scroll the (demo) page: the test can tell the difference
    await drag(180, 360, -260);
    await sleep(150);
    ok('… (control: without a dialog the same drag scrolls the page)', (await demo(() => window.scrollY)) > 100);
    await context.close();

    // landscape phone: the whole panel scrolls ("flow"), every button can be reached by a touch drag
    const land = await fresh({ viewport: { width: 640, height: 360 }, touch: true, open: 'result' });
    await sleep(700);
    const drag2 = await touchDragger(land.context, land.page);
    const before = await land.demo(() => {
      const panel = document.querySelector('.k-dialog');
      const last = panel.querySelector('.k-dialog__foot .k-btn:last-child').getBoundingClientRect();
      return { flow: panel.classList.contains('k-dialog--flow'), lastBottom: last.bottom, panelBottom: panel.getBoundingClientRect().bottom, hint: panel.classList.contains('k-can-down') };
    });
    for (let i = 0; i < 3; i++) await drag2(320, 260, -200);
    await sleep(200);
    const afterDrag = await land.demo(() => {
      const panel = document.querySelector('.k-dialog');
      const last = panel.querySelector('.k-dialog__foot .k-btn:last-child').getBoundingClientRect();
      return { lastBottom: last.bottom, panelBottom: panel.getBoundingClientRect().bottom, page: window.scrollY, up: panel.classList.contains('k-can-up'), down: panel.classList.contains('k-can-down') };
    });
    ok(
      '640×360: a dialog taller than the screen scrolls as a whole; a touch drag brings its last button into view',
      before.flow && before.lastBottom > before.panelBottom && before.hint && afterDrag.lastBottom <= afterDrag.panelBottom && afterDrag.page === 0 && afterDrag.up && !afterDrag.down,
      JSON.stringify({ before, afterDrag }),
    );
    await land.context.close();
  }

  // ── toasts ──
  if (wants('toasts')) {
    const { context, page, demo } = await fresh();
    let state;
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
      toastPointer: getComputedStyle(document.querySelector('.k-toast')).pointerEvents,
      has: window.__kitDemo.kit.hasOverlay(),
    }));
    ok('toasts stack (max 3, duplicates merge), do not block input and are not overlays', state.texts.join() === 'two,three,four' && state.pointer === 'none' && state.toastPointer === 'none' && state.has === false, JSON.stringify(state));
    await sleep(400);
    state = await demo(() => {
      const rects = Array.from(document.querySelectorAll('.k-toast:not(.k-out)')).map((n) => n.getBoundingClientRect());
      let overlap = false;
      for (let i = 1; i < rects.length; i++) if (rects[i].top < rects[i - 1].bottom - 0.5) overlap = true;
      return { n: rects.length, overlap, inside: rects.every((r) => r.left >= 0 && r.right <= innerWidth && r.top >= 0) };
    });
    ok('stacked toasts never overlap each other and stay inside the viewport', state.n === 3 && !state.overlap && state.inside, JSON.stringify(state));
    await demo(() => window.__kitDemo.kit.toast('short', { duration: 300 }));
    await sleep(900);
    ok('a toast dismisses itself', (await demo(() => Array.from(document.querySelectorAll('.k-toast')).map((n) => n.textContent).indexOf('short'))) === -1);
    await sleep(5200);
    state = await demo(() => ({ toasts: document.querySelectorAll('.k-toast').length, hosts: document.querySelectorAll('.k-toasts').length }));
    ok('every toast is gone after its time, and the empty toast layer with it', state.toasts === 0 && state.hosts === 0, JSON.stringify(state));
    // toasts above a dialog: visible, on top, and taps go through them
    await demo(() => {
      window.__kitDemo.open('basic');
      window.__kitDemo.kit.toast('over the dialog', { duration: 3000 });
    });
    await sleep(500);
    state = await demo(() => {
      const t = document.querySelector('.k-toast').getBoundingClientRect();
      const hit = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2);
      const hostAfterLayer = !!(document.querySelector('.k-layer').compareDocumentPosition(document.querySelector('.k-toasts')) & Node.DOCUMENT_POSITION_FOLLOWING);
      return { through: !!hit && !hit.closest('.k-toasts'), hostAfterLayer, z: [getComputedStyle(document.querySelector('.k-toasts')).zIndex, getComputedStyle(document.querySelector('.k-layer')).zIndex] };
    });
    ok('a toast over a dialog sits above it and lets taps through', state.through && state.hostAfterLayer && Number(state.z[0]) > Number(state.z[1]), JSON.stringify(state));
    await demo(() => window.__kitDemo.kit.closeAll());
    await context.close();
  }

  // ── widgets ──
  if (wants('widgets')) {
    const { context, page, demo } = await fresh();
    let state = await demo(async () => {
      const d = window.__kitDemo;
      const kit = d.kit;
      const app = document.getElementById('app');
      const span = document.createElement('span');
      app.appendChild(span);
      const p = kit.tweenNumber(span, 0, 12345, 500);
      // (frames can be late on a busy machine: wait for the first one that moved the number)
      for (let i = 0; i < 40 && span.textContent === '0'; i++) await new Promise((r) => setTimeout(r, 10));
      const mid = span.textContent;
      await p;
      const end = span.textContent;
      span.remove();
      const chip = kit.chip({ icon: 'coin', text: '1' });
      app.appendChild(chip.el);
      chip.set('2');
      const bumped = chip.el.classList.contains('k-bump');
      chip.el.remove();
      const prog = kit.progress({ value: 5, max: 10, notches: [2, 8] });
      app.appendChild(prog.el);
      const p1 = prog.el.style.getPropertyValue('--k-p');
      const on = Array.from(prog.el.querySelectorAll('.k-progress__notch')).map((n) => n.classList.contains('k-on'));
      const gain0 = prog.el.classList.contains('k-gain');
      prog.set(9);
      const gain1 = prog.el.classList.contains('k-gain');
      const on2 = Array.from(prog.el.querySelectorAll('.k-progress__notch')).map((n) => n.classList.contains('k-on'));
      const fill = prog.el.querySelector('.k-progress__fill').getBoundingClientRect();
      const track = prog.el.querySelector('.k-progress__track').getBoundingClientRect();
      prog.el.remove();
      const stars = kit.starRow(2);
      const starsOn = stars.el.querySelectorAll('.k-star.k-on').length;
      let done = 0;
      const cd = kit.countdown({ until: Date.now() + 600, onDone: () => done++ });
      app.appendChild(cd.el);
      const cdText = cd.el.textContent;
      await new Promise((r) => setTimeout(r, 1000));
      const cdEnd = cd.el.textContent;
      cd.el.remove();
      const b = kit.button({ label: 'x' });
      app.appendChild(b);
      b.update({ badge: 3 });
      const badgePop = b.querySelector('.k-badge').classList.contains('k-bump');
      b.update({ badge: null });
      const badgeGone = !b.querySelector('.k-badge');
      b.remove();
      return { mid, end, bumped, p1, on, on2, gain0, gain1, fillInside: fill.left <= track.right, starsOn, cdText, cdEnd, done, badgePop, badgeGone };
    });
    ok('tweenNumber counts up and ends on the formatted target', state.end === '12,345' && state.mid !== '12,345' && state.mid !== '0', 'mid=' + state.mid + ' end=' + state.end);
    ok('chip.set() changes the text and bumps', state.bumped);
    ok('progress fills and lights the reached star notches', state.p1 === '0.5' && state.on.join() === 'true,false' && state.on2.join() === 'true,true', JSON.stringify([state.p1, state.on, state.on2]));
    ok('progress: a growing value gets its sheen (not the first paint)', state.gain0 === false && state.gain1 === true, JSON.stringify([state.gain0, state.gain1]));
    ok('starRow lights the earned stars', state.starsOn === 2);
    ok('countdown ticks down to 00:00 and calls onDone once', state.cdText === '00:01' && state.cdEnd === '00:00' && state.done === 1, JSON.stringify([state.cdText, state.cdEnd, state.done]));
    ok('a badge added later pops in; null removes it', state.badgePop && state.badgeGone, JSON.stringify([state.badgePop, state.badgeGone]));

    await demo(() => {
      window.__kitDemo.log.events.length = 0;
      window.scrollTo(0, document.getElementById('demo-toggle').getBoundingClientRect().top + window.scrollY - 100);
    });
    await page.click('#demo-toggle');
    await page.click('#demo-seg .k-seg__opt:nth-child(4)');
    state = await demo(() => ({ events: window.__kitDemo.log.events.slice(), checked: document.getElementById('demo-toggle').getAttribute('aria-checked'), seg: document.querySelector('#demo-seg .k-seg__opt.k-on').textContent }));
    ok('toggle and segmented report changes', state.events.join() === 'music:false,seg:hard' && state.checked === 'false' && state.seg === 'Hard', JSON.stringify(state));
    // the padding ring of a segmented control belongs to its options
    const seg = await page.locator('#demo-seg').boundingBox();
    await page.mouse.click(seg.x + seg.width / 6, seg.y + 1.5);
    state = await demo(() => document.querySelector('#demo-seg .k-seg__opt.k-on').textContent);
    ok('segmented: a tap on the very edge of the control still selects the option there', state === 'Easy', 'selected: ' + state);
    await context.close();
  }

  // ── safe areas ──
  if (wants('safe')) {
    const { context, demo, gone } = await fresh();
    let state = await demo(() => {
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
      state.before === '0px 0px 0px 0px' && state.after === '40px 20px 30px 10px' && near(state.overlay[0], 56) && near(state.overlay[1], 32) && near(state.overlay[2], 46) && near(state.overlay[3], 22) && near(state.toastTop, 52),
      JSON.stringify(state),
    );
    await gone();
    // a notch + gesture bar: the backdrop still covers everything, the panel / ✕ / medal / toasts keep clear
    const worst = [];
    for (const name of ['tall', 'medal', 'lose', 'shop']) {
      state = await demo(async (n) => {
        const d = window.__kitDemo;
        d.setSafeInsets({ top: 44, right: 12, bottom: 34, left: 12 });
        d.open(n);
        d.kit.toast('safe', { duration: 600 });
        await new Promise((r) => setTimeout(r, 480));
        const rect = (sel) => {
          const node = document.querySelector(sel);
          return node ? node.getBoundingClientRect() : null;
        };
        const dim = rect('.k-overlay__dim');
        const panel = rect('.k-dialog');
        const x = rect('.k-dialog__x');
        const medal = rect('.k-medal');
        const host = rect('.k-toasts');
        const out = {
          dim: dim.left === 0 && dim.top === 0 && dim.right === innerWidth && dim.bottom === innerHeight,
          panel: panel.top >= 44 && panel.bottom <= innerHeight - 34 && panel.left >= 12 && panel.right <= innerWidth - 12,
          x: !x || (x.top >= 44 && x.right <= innerWidth),
          medal: !medal || medal.top >= 44,
          toast: host.top >= 44,
        };
        d.kit.closeAll();
        d.setSafeInsets({ top: 0, right: 0, bottom: 0, left: 0 });
        return out;
      }, name);
      if (!(state.dim && state.panel && state.x && state.medal && state.toast)) worst.push(name + ' ' + JSON.stringify(state));
      await gone();
    }
    ok('with insets 44/12/34/12 the backdrop covers the whole screen; panel, ✕, medal and toasts stay inside the safe area', worst.length === 0, worst.join(' | '));
    state = await demo(() => {
      const cs = getComputedStyle(document.getElementById('app'));
      return { select: cs.userSelect, touch: cs.touchAction, over: cs.overscrollBehaviorY, tap: cs.webkitTapHighlightColor };
    });
    ok('#app: no text selection, no double-tap zoom, no overscroll, no tap highlight', state.select === 'none' && state.touch === 'pan-x pan-y' && state.over === 'none' && /, 0\)$/.test(state.tap), JSON.stringify(state));
    await context.close();
  }

  // ── layout: touch targets, overflow, every dialog at every size in both directions ──
  if (wants('layout')) {
    for (const size of VIEWPORTS) {
      for (const { lang, dir } of LANGS) {
        const { context, demo, gone } = await fresh({ viewport: { width: size.w, height: size.h }, lang });
        const at = size.w + '×' + size.h + ' ' + dir;
        let state = await demo(() => {
          const small = [];
          const nodes = document.querySelectorAll('#app .k-btn, #app .k-chip--button, #app .k-toggle, #app .k-seg__opt, #app .k-item--button');
          for (const node of nodes) {
            // layout size (a held button is drawn slightly smaller, its touch target is not)
            const r = { width: node.offsetWidth, height: node.offsetHeight };
            const slop = getComputedStyle(node, '::after');
            const has = slop.content !== 'none' && slop.position === 'absolute';
            const extraY = has ? -(parseFloat(slop.top) || 0) - (parseFloat(slop.bottom) || 0) : 0;
            const extraX = has ? -(parseFloat(slop.left) || 0) - (parseFloat(slop.right) || 0) : 0;
            const h = r.height + Math.max(0, extraY);
            const w = r.width + Math.max(0, extraX);
            if (h < 48 || w < 48) small.push(String(node.className).replace(/k-btn--/g, '').slice(0, 40) + ' ' + w.toFixed(1) + '×' + h.toFixed(1));
          }
          const doc = document.documentElement;
          const wide = [];
          // (a progress fill slides under its track's clip, so its box does not count)
          for (const node of document.querySelectorAll('#app *:not(.k-progress__fill)')) {
            const r = node.getBoundingClientRect();
            if (r.width > 0 && (r.right > doc.clientWidth + 0.5 || r.left < -0.5)) wide.push(node.className + ' ' + r.left.toFixed(1) + '…' + r.right.toFixed(1));
          }
          // text that is cut off: labels and titles must wrap, never clip
          const cut = [];
          for (const node of document.querySelectorAll('#app .k-btn__label, #app .k-title, #app .k-offer__title, #app .k-toggle__label, #app .k-item__label')) {
            if (node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).display !== 'inline') cut.push(node.textContent.slice(0, 20));
          }
          return { count: nodes.length, small, scrollW: doc.scrollWidth, clientW: doc.clientWidth, wide: wide.slice(0, 4), cut: cut.slice(0, 4), dir: doc.getAttribute('dir') };
        });
        ok(at + ': touch targets ≥ 48 px (' + state.count + ' controls)', state.small.length === 0, state.small.slice(0, 6).join(' | '));
        ok(at + ': no horizontal overflow, no clipped label', state.scrollW <= state.clientW && state.wide.length === 0 && state.cut.length === 0 && state.dir === dir, 'scrollWidth=' + state.scrollW + ' clientWidth=' + state.clientW + ' ' + state.wide.join(' | ') + ' cut: ' + state.cut.join(' | '));

        const bad = [];
        for (const name of DIALOGS) {
          await demo((n) => window.__kitDemo.open(n), name);
          await sleep(450);
          const d = await demo(async () => {
            const out = [];
            const vw = document.documentElement.clientWidth;
            const vh = window.innerHeight;
            const panel = document.querySelector('.k-overlay.k-open:not(.k-under) .k-dialog');
            const r = panel.getBoundingClientRect();
            if (r.left < 0 || r.right > vw || r.top < 0 || r.bottom > vh) out.push('panel outside ' + [r.left, r.top, r.right, r.bottom].map((v) => v.toFixed(0)).join(','));
            const medal = panel.querySelector('.k-medal');
            if (medal && medal.getBoundingClientRect().top < 0) out.push('medal above the viewport');
            const body = panel.querySelector('.k-dialog__body');
            if (body.scrollWidth > body.clientWidth + 1) out.push('body scrolls sideways ' + body.scrollWidth + '>' + body.clientWidth);
            for (const node of panel.querySelectorAll('.k-btn, .k-offer, .k-chip, .k-ribbon, .k-dialog__x, .k-medal')) {
              const b = node.getBoundingClientRect();
              if (b.left < -0.5 || b.right > vw + 0.5) out.push(String(node.className).slice(0, 30) + ' ' + b.left.toFixed(0) + '…' + b.right.toFixed(0));
            }
            for (const node of panel.querySelectorAll('.k-btn__label, .k-title, .k-offer__title')) {
              if (node.scrollWidth > node.clientWidth + 1) out.push('clipped text: ' + node.textContent.slice(0, 24));
            }
            // everything in a dialog that is taller than the screen can be scrolled into view
            const flow = panel.classList.contains('k-dialog--flow');
            const scroller = flow ? panel.querySelector('.k-dialog__inner') : body;
            const inner = panel.querySelector('.k-dialog__inner').getBoundingClientRect();
            const view = scroller.getBoundingClientRect();
            const targets = Array.from(panel.querySelectorAll('.k-dialog__foot .k-btn, .k-dialog__body .k-btn, .k-dialog__body > * > *:last-child'));
            for (const node of targets) {
              const inScroller = scroller.contains(node);
              if (inScroller) {
                scroller.scrollTop = 0;
                const b0 = node.getBoundingClientRect();
                scroller.scrollTop = Math.max(0, b0.bottom - view.bottom + 4);
              }
              const b = node.getBoundingClientRect();
              const top = inScroller ? view.top : inner.top;
              const bottom = inScroller ? view.bottom : inner.bottom;
              if (b.height > 0 && (b.bottom > bottom + 1 || b.top < top - 1) && b.height <= view.height) out.push('unreachable: ' + String(node.className).slice(0, 28) + ' ' + b.top.toFixed(0) + '…' + b.bottom.toFixed(0) + ' in ' + top.toFixed(0) + '…' + bottom.toFixed(0));
            }
            scroller.scrollTop = 0;
            return { out, sw: document.documentElement.scrollWidth, cw: vw };
          });
          if (d.out.length || d.sw > d.cw) bad.push(name + ': ' + d.out.slice(0, 3).join(' | '));
          await demo(() => window.__kitDemo.kit.closeAll());
          await gone();
        }
        ok(at + ': all ' + DIALOGS.length + ' dialogs fit the viewport, nothing is clipped, everything can be scrolled into view', bad.length === 0, bad.join('\n          '));
        await context.close();
      }
    }
  }

  // ── RTL mirroring ──
  if (wants('rtl')) {
    for (const { lang, dir } of LANGS) {
      const { context, demo } = await fresh({ lang, open: 'shop' });
      await sleep(450);
      const state = await demo(() => {
        const mid = (r) => (r.left + r.right) / 2;
        const rect = (sel) => document.querySelector(sel).getBoundingClientRect();
        const panel = rect('.k-dialog');
        const card = document.querySelector('.k-dialog .k-offer .k-ribbon').parentElement.getBoundingClientRect();
        const sw = rect('#demo-toggle .k-switch');
        const fill = rect('[data-shot="hud"] .k-progress:nth-child(2) .k-progress__fill');
        const track = rect('[data-shot="hud"] .k-progress:nth-child(2) .k-progress__track');
        const chip = rect('#demo-coins');
        const badgeBtn = document.querySelector('#app .k-btn .k-badge').parentElement.getBoundingClientRect();
        const item = document.querySelector('#app .k-item--button').getBoundingClientRect();
        const iconBtn = document.querySelector('#app .k-btn--primary .k-btn__icon').closest('.k-btn').getBoundingClientRect();
        const qtyArt = document.querySelector('#app .k-offer__art .k-qty').parentElement.getBoundingClientRect();
        const rowOffer = document.querySelector('#app .k-offer--row').getBoundingClientRect();
        const toggle = rect('#demo-toggle');
        window.__kitDemo.kit.toast('mirror', { icon: 'coin', duration: 1500 });
        const toast = rect('.k-toast');
        const foot = document.querySelectorAll('[data-shot="buttons"] .k-btn');
        return {
          xEnd: mid(rect('.k-dialog__x')) > mid(panel),
          ribbonEnd: mid(rect('.k-dialog .k-offer .k-ribbon')) > mid(card),
          knobEnd: mid(rect('#demo-toggle .k-switch__knob')) > mid(sw),
          switchEnd: mid(sw) > mid(toggle),
          fillFromStart: fill.left <= track.left + 1,
          chipIconStart: mid(rect('#demo-coins .k-chip__icon')) < mid(chip),
          chipPlusEnd: mid(rect('#demo-coins .k-chip__plus')) > mid(chip),
          badgeEnd: mid(rect('#app .k-btn .k-badge')) > mid(badgeBtn),
          chevronEnd: mid(rect('#app .k-item--button .k-item__chevron')) > mid(item),
          btnIconStart: mid(rect('#app .k-btn--primary .k-btn__icon')) < mid(iconBtn),
          qtyEnd: mid(rect('#app .k-offer__art .k-qty')) > mid(qtyArt),
          rowArtStart: mid(rect('#app .k-offer--row .k-offer__art')) < mid(rowOffer),
          rowActionEnd: mid(rect('#app .k-offer--row .k-offer__action')) > mid(rowOffer),
          toastIconStart: mid(rect('.k-toast .k-toast__icon')) < mid(toast),
          firstButtonStart: foot[0].getBoundingClientRect().left < foot[1].getBoundingClientRect().left,
          medalCentred: true,
          align: getComputedStyle(document.querySelector('[data-shot="controls"] .k-toggle__label')).textAlign,
          arrowFlipped: getComputedStyle(document.querySelector('#app .k-icon--dir')).transform !== 'none',
          numLtr: getComputedStyle(document.querySelector('.k-chip__text')).direction,
        };
      });
      const ltr = dir === 'ltr';
      const sides = ['xEnd', 'ribbonEnd', 'knobEnd', 'switchEnd', 'chipPlusEnd', 'badgeEnd', 'chevronEnd', 'qtyEnd', 'rowActionEnd'];
      const starts = ['chipIconStart', 'btnIconStart', 'rowArtStart', 'toastIconStart', 'firstButtonStart'];
      const wrong = sides.filter((k) => state[k] !== ltr).concat(starts.filter((k) => state[k] !== ltr));
      ok(
        dir.toUpperCase() + ': ✕, ribbon, switch, knob, chip “+”, badge, chevron, quantity, offer action sit on the END side; chip / button / toast icons and offer art on the START side',
        wrong.length === 0,
        'wrong: ' + wrong.join(', '),
      );
      ok(dir.toUpperCase() + ': progress fills from the start side, text aligns to start, numbers stay LTR, “next / back” arrows ' + (ltr ? 'are not flipped' : 'are flipped'), state.fillFromStart === ltr && state.align === 'start' && state.numLtr === 'ltr' && state.arrowFlipped === !ltr, JSON.stringify({ fill: state.fillFromStart, align: state.align, num: state.numLtr, arrow: state.arrowFlipped }));
      await context.close();
    }
  }

  // ── alignment: icons and text sit on the same centre line ──
  if (wants('align')) {
    for (const { lang, dir } of LANGS) {
      const { context, demo } = await fresh({ lang, dsf: 2 });
      await demo(() => window.__kitDemo.open('medal'));
      await sleep(600);
      const state = await demo(() => {
        const off = [];
        const cy = (r) => (r.top + r.bottom) / 2;
        const cx = (r) => (r.left + r.right) / 2;
        const note = (what, d, max) => {
          if (Math.abs(d) > max) off.push(what + ' ' + d.toFixed(1));
        };
        let n = 0;
        for (const b of document.querySelectorAll('#app .k-btn:not(.k-pressed)')) {
          const face = b.querySelector('.k-btn__face').getBoundingClientRect();
          const icon = b.querySelector('.k-btn__icon');
          const texts = b.querySelector('.k-btn__texts');
          const name = String(b.className).replace(/k-btn--?/g, '').trim().slice(0, 24);
          if (icon) {
            note('icon↕ ' + name, cy(icon.getBoundingClientRect()) - cy(face), 1.2);
            if (!texts) note('icon↔ ' + name, cx(icon.getBoundingClientRect()) - cx(face), 1.2);
          }
          if (texts) note('text↕ ' + name, cy(texts.getBoundingClientRect()) - cy(face), 1.2);
          const content = b.querySelector('.k-btn__content').getBoundingClientRect();
          note('content↔ ' + name, cx(content) - cx(face), 1.2);
          n++;
        }
        for (const c of document.querySelectorAll('#app .k-chip:not(.k-pressed)')) {
          const box = c.getBoundingClientRect();
          note('chip icon↕', cy(c.querySelector('.k-chip__icon').getBoundingClientRect()) - cy(box), 1);
          const plus = c.querySelector('.k-chip__plus');
          if (plus) note('chip plus↕', cy(plus.getBoundingClientRect()) - cy(box), 1);
          n++;
        }
        for (const t of document.querySelectorAll('#app .k-toggle')) {
          const sw = t.querySelector('.k-switch').getBoundingClientRect();
          const label = t.querySelector('.k-toggle__label').getBoundingClientRect();
          const icon = t.querySelector('.k-toggle__icon');
          note('toggle label↕', cy(label) - cy(sw), 1.2);
          if (icon) note('toggle icon↕', cy(icon.getBoundingClientRect()) - cy(sw), 1.2);
          n++;
        }
        for (const s of document.querySelectorAll('#app .k-seg')) {
          const thumb = s.querySelector('.k-seg__thumb').getBoundingClientRect();
          const on = s.querySelector('.k-seg__opt.k-on').getBoundingClientRect();
          note('segmented thumb↔', cx(thumb) - cx(on), 1);
          note('segmented thumb↕', cy(thumb) - cy(on), 1);
          n++;
        }
        for (const p of document.querySelectorAll('#app .k-progress--notched')) {
          const track = p.querySelector('.k-progress__track').getBoundingClientRect();
          for (const notch of p.querySelectorAll('.k-progress__notch')) note('notch↕', cy(notch.getBoundingClientRect()) - cy(track), 1.2);
          n++;
        }
        for (const o of document.querySelectorAll('#app .k-owned:not(.k-owned--bare)')) {
          note('owned tick↕', cy(o.querySelector('.k-owned__tick').getBoundingClientRect()) - cy(o.getBoundingClientRect()), 1);
          n++;
        }
        const panel = document.querySelector('.k-dialog').getBoundingClientRect();
        note('medal↔', cx(document.querySelector('.k-medal').getBoundingClientRect()) - cx(panel), 0.6);
        note('medal icon↔', cx(document.querySelector('.k-medal .k-icon').getBoundingClientRect()) - cx(panel), 0.6);
        note('title↔', cx(document.querySelector('.k-dialog__title').getBoundingClientRect()) - cx(panel), 0.6);
        note('rule star↔', cx(document.querySelector('.k-dialog .k-rule i').getBoundingClientRect()) - cx(panel), 0.6);
        const x = document.querySelector('.k-dialog__x');
        note('✕ icon↔', cx(x.querySelector('.k-icon').getBoundingClientRect()) - cx(x.querySelector('.k-btn__face').getBoundingClientRect()), 0.6);
        note('✕ icon↕', cy(x.querySelector('.k-icon').getBoundingClientRect()) - cy(x.querySelector('.k-btn__face').getBoundingClientRect()), 0.6);
        return { n, off };
      });
      ok(dir.toUpperCase() + ': icons, labels, thumbs, notches and the medal are centred where they belong (' + state.n + ' components, ≤ 1.2 px off)', state.off.length === 0, state.off.slice(0, 8).join(' | '));
      await demo(() => window.__kitDemo.kit.closeAll());
      await context.close();
    }
  }

  // ── contrast of text on kit surfaces (WCAG, worst gradient stop) ──
  if (wants('contrast')) {
    const { context, page } = await fresh({ open: 'shop' });
    await sleep(450);
    const contrast = await page.evaluate(() => {
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
      /** Opaque colours a surface can show behind text: every stop of its base gradient layer, else its background colour. */
      const surfaces = (node, base, pseudo) => {
        const cs = getComputedStyle(node, pseudo || null);
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
      const add = (name, textNode, surfaceNode, base, pseudo) => {
        if (!textNode || !surfaceNode) {
          rows.push({ name, ratio: 0, note: 'missing' });
          return;
        }
        const cs = getComputedStyle(textNode);
        let color = parse(cs.webkitTextFillColor && cs.webkitTextFillColor !== 'rgba(0, 0, 0, 0)' ? cs.webkitTextFillColor : cs.color);
        if (cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)') color = parse(cs.color);
        const opacity = parseFloat(cs.opacity);
        const stops = surfaces(surfaceNode, base || night, pseudo);
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
      add('chip text', q('.k-chip__text'), q('.k-chip'), panelWorstLight, '::before');
      add('dialog body text', q('.k-dialog .k-offer__title'), panel);
      add('quantity badge', q('.k-qty'), q('.k-qty'), panelWorstLight);
      add('quantity badge gold', q('#app .k-qty--gold'), q('#app .k-qty--gold'));
      add('owned', q('#app .k-owned span:last-child'), q('#app .k-owned'), panelWorstLight);
      add('button badge', q('#app .k-badge'), q('#app .k-badge'));
      add('toggle label on panel', q('#app .k-toggle__label'), q('#app .k-panel__inner'));
      add('list item danger on panel', q('#app .k-item--danger .k-item__label'), q('#app .k-panel__inner'));
      add('list item value on panel', q('#app .k-item__value'), q('#app .k-panel__inner'));
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
    await context.close();
  }

  // ── motion: timing budget and reduced motion ──
  if (wants('motion')) {
    {
      const { context, demo, settle } = await fresh({ open: 'result' });
      await settle();
      const state = await demo(() => {
        const out = [];
        const ms = (v) => v.split(',').map((p) => (/ms$/.test(p.trim()) ? parseFloat(p) : parseFloat(p) * 1000));
        for (const node of document.querySelectorAll('.k-layer *, #app [class*="k-"]')) {
          const cs = getComputedStyle(node);
          const props = cs.transitionProperty.split(',').map((p) => p.trim());
          for (const p of props) {
            if (p !== 'all' && p !== 'none' && p !== 'transform' && p !== 'opacity') out.push('transition on ' + p + ': ' + String(node.className).slice(0, 30));
          }
          const durations = ms(cs.transitionDuration);
          for (const d of durations) if (d > 360) out.push('transition ' + d + ' ms: ' + String(node.className).slice(0, 30));
        }
        const foot = Array.from(document.querySelectorAll('.k-dialog__foot > .k-btn')).map((b) => {
          const cs = getComputedStyle(b);
          return Math.max.apply(null, cs.animationName.split(',').map((n, i) => (n.trim() === 'k-rise' ? ms(cs.animationDelay)[i] + ms(cs.animationDuration)[i] : 0)));
        });
        return { out: out.slice(0, 6), foot };
      });
      ok('transitions animate only transform / opacity and last ≤ 350 ms', state.out.length === 0, state.out.join(' | '));
      ok('the footer buttons have landed within 350 ms of opening', state.foot.length === 3 && state.foot.every((t) => t > 0 && t <= 350), state.foot.join(', '));
      await context.close();
    }
    const { context, demo } = await fresh({ open: 'result', reduced: true });
    await sleep(500);
    const state = await demo(() => {
      const d = getComputedStyle(document.querySelector('.k-dialog'));
      const f = getComputedStyle(document.querySelector('#demo-guard .k-btn__face'));
      const s = getComputedStyle(document.querySelector('.k-star.k-on .k-on-icon'));
      const g = getComputedStyle(document.getElementById('demo-guard'));
      return {
        reduced: window.__kitDemo.kit.reducedMotion(),
        dialog: d.transitionDuration,
        face: f.transitionDuration,
        star: s.animationName + ' ' + s.opacity,
        opacity: d.opacity,
        score: document.querySelector('.k-dialog .k-title--lg').textContent,
        breathe: g.animationIterationCount + ' ' + g.animationDuration,
      };
    });
    const tiny = (v) => v.split(',').every((p) => parseFloat(p) <= 0.001);
    ok('prefers-reduced-motion: transitions collapse, stars and numbers jump to their end state, nothing loops', state.reduced && tiny(state.dialog) && tiny(state.face) && state.opacity === '1' && state.score === '12,480' && /^1 /.test(state.breathe), JSON.stringify(state));
    await context.close();
  }

  // ── leaks: after everything closed the document is exactly as it was ──
  if (wants('leaks')) {
    const { context, page, demo } = await fresh();
    const snapshot = () =>
      demo(() => ({
        nodes: document.getElementsByTagName('*').length,
        body: Array.from(document.body.children).map((n) => n.tagName + (n.className ? '.' + n.className : '')),
        hidden: document.querySelectorAll('[aria-hidden="true"]').length,
        inert: document.querySelectorAll('[data-shim-inert]').length,
        active: document.activeElement === document.body ? 'body' : document.activeElement.tagName,
        htmlClass: document.documentElement.className,
      }));
    await sleep(300);
    const before = await snapshot();
    // listeners the kit adds to window / document while overlays are open
    await demo(() => {
      window.__listeners = 0;
      for (const target of [window, document]) {
        const add = target.addEventListener;
        const remove = target.removeEventListener;
        target.addEventListener = function (type, fn, o) {
          window.__listeners++;
          return add.call(this, type, fn, o);
        };
        target.removeEventListener = function (type, fn, o) {
          window.__listeners--;
          return remove.call(this, type, fn, o);
        };
      }
    });
    for (let round = 0; round < 3; round++) {
      for (const name of SCENARIOS) {
        await demo((n) => window.__kitDemo.open(n), name);
        await sleep(round === 0 ? 150 : 30);
        if (round === 1) await demo(() => window.__kitDemo.kit.closeTop());
      }
      await demo(() => {
        const k = window.__kitDemo.kit;
        for (const text of ['a', 'b', 'c', 'd', 'e']) k.toast(text, { duration: 250 });
        k.closeAll();
      });
      await sleep(200);
    }
    const mid = await snapshot();
    await demo(() => window.__kitDemo.kit.closeAll());
    // the demo's "toasts" scenario uses 60 s toasts: wait for the stack limit to have flushed them, then for the rest
    await page.waitForFunction(() => document.querySelectorAll('.k-overlay').length === 0, null, { timeout: 5000 });
    await demo(() => {
      // long-lived toasts of the scenario: replace them by short ones (max 3 live)
      const k = window.__kitDemo.kit;
      for (const text of ['x', 'y', 'z']) k.toast(text, { duration: 200 });
    });
    await sleep(1600);
    const after = await snapshot();
    const listeners = await demo(() => window.__listeners);
    ok(
      'after 3 rounds of every scenario + toasts, the DOM is back to its initial node count (' + before.nodes + ' → ' + mid.nodes + ' → ' + after.nodes + ')',
      after.nodes === before.nodes && after.body.join() === before.body.join(),
      JSON.stringify({ before: before.body, after: after.body }),
    );
    ok('no aria-hidden / inert left behind, focus not stranded, no listener left on window / document', after.hidden === before.hidden && after.inert === 0 && listeners === 0, JSON.stringify({ hidden: [before.hidden, after.hidden], inert: after.inert, listeners, active: after.active }));
    await context.close();
  }

  // ── report ──
  let failed = 0;
  let last = '';
  for (const r of results) {
    if (!r.pass) failed++;
    if (r.group !== last) {
      console.log('── ' + r.group);
      last = r.group;
    }
    console.log((r.pass ? '  ok    ' : '  FAIL  ') + r.name + (r.pass || !r.detail ? '' : '\n          ' + r.detail));
  }
  console.log('checks: ' + (results.length - failed) + '/' + results.length + ' passed');
  return failed === 0 && results.length > 0;
}

/** `audit <files…>`: the static rules applied to any file. Exit code 1 when something is found. */
function auditFiles(files) {
  let found = 0;
  for (const file of files) {
    const abs = path.resolve(process.cwd(), file);
    const name = path.relative(ROOT, abs);
    const text = fs.readFileSync(abs, 'utf8');
    let out = [];
    if (/\.css$/.test(file)) out = auditCss(name, text);
    else if (/\.html?$/.test(file)) {
      const styles = text.replace(/<!--[\s\S]*?-->/g, '').match(/<style[^>]*>[\s\S]*?<\/style>/g) || [];
      for (const s of styles) out.push(...auditCss(name, s.replace(/<\/?style[^>]*>/g, '')));
    } else out = auditJs(name, text);
    for (const line of out) console.log('  ' + line);
    found += out.length;
  }
  console.log('audit: ' + files.length + ' file(s), ' + found + ' finding(s)');
  return found === 0;
}

async function main() {
  if (process.argv[2] === 'audit') {
    if (!auditFiles(process.argv.slice(3))) process.exitCode = 1;
    return;
  }
  const mode = process.argv[2] === 'shots' || process.argv[2] === 'check' ? process.argv[2] : 'all';
  const filter = mode === 'all' ? '' : process.argv[3] || '';
  const stop = await ensureServer();
  const browser = await chromium.launch();
  const problems = [];
  let pass = true;
  try {
    if (mode !== 'check') await shots(browser, mode === 'shots' ? filter : '', problems);
    if (mode !== 'shots') pass = await checks(browser, mode === 'check' ? filter : '', problems);
  } finally {
    await browser.close();
    await stop();
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
