/**
 * Mechanical checks for the Google Play kit in store/. Nothing here is a matter of taste: every
 * check is a hard rule taken from Google's own pages (docs/research/play-policy.md, naming-ip.md).
 *
 *   node tools/store/check-kit.cjs                  run every check; exit code 1 if one fails
 *   node tools/store/check-kit.cjs --write-counts   first rewrite the "عدد الأحرف: N / L" line under
 *                                                   each listing field with the counted value
 *   node tools/store/check-kit.cjs listing          only one group: listing | graphics | privacy | screenshots
 *
 * What is checked
 *   listing      store/listing/en.md and ar.md: every field marked `<!-- field: name | limit: N -->`
 *                is counted (Unicode code points, and UTF-16 units as the stricter reading) against its
 *                limit (title 30, short description 80, full description 4000, release notes 500);
 *                the count written under the field must be the counted one; no emoji, no word in
 *                capitals, no ranking / price / promotion words, no call to action, no name or
 *                vocabulary of another game, and the short description is not repeated in the full one.
 *   graphics     store/graphics: feature-graphic.png and feature-graphic-ar.png are exactly 1024×500,
 *                8-bit RGB with no alpha channel; icon-512.png is exactly 512×512, every pixel is
 *                fully opaque (corners included, so no rounded corners), and it shows the same emblem
 *                as the Android project's launcher icons (android/app/src/main/res/mipmap-*).
 *   privacy      store/privacy/index.html opens in headless Chromium from disk with no console error,
 *                no page error and no network request at all, shows both languages, switches between
 *                them, and still carries (or no longer carries) the owner's placeholders — reported.
 *   screenshots  store/screenshots (see check-shots.cjs for the full list): for each language and
 *                device class (phone 1080×1920, 7-inch 1200×1920, 10-inch 1600×2560) the exact set of
 *                upload files and raw captures — exact pixel size, RGB PNG without alpha, under 8 MB,
 *                the number per folder; every upload file is still its raw capture, only scaled
 *                (compared pixel by pixel) and unchanged since the tool wrote it (checksums); the
 *                manifest names language, level, seed and moment of every capture; captions are 2–5
 *                words without ranking / price / call-to-action wording and take under 20 % of the
 *                image (measured as laid out and again in the pixels); alt texts at most 140 characters.
 *
 * Playwright is the globally installed one; it is only loaded for the privacy check.
 */
const fs = require('fs');
const path = require('path');
const { ROOT, pngInfo, decodePng } = require('./lib.cjs');
const shots = require('./check-shots.cjs');

/** STORE_DIR=<dir> checks a copy of the kit somewhere else (used to prove that the checks really fail). */
const STORE = process.env.STORE_DIR ? path.resolve(process.env.STORE_DIR) : path.join(ROOT, 'store');
const args = process.argv.slice(2);
const WRITE = args.includes('--write-counts');
const groups = args.filter((a) => !a.startsWith('--'));
const want = (name) => groups.length === 0 || groups.includes(name);

let failures = 0;
const notes = [];
function ok(msg) {
  console.log('  ok    ' + msg);
}
function fail(msg) {
  failures++;
  console.log('  FAIL  ' + msg);
}
function note(msg) {
  notes.push(msg);
  console.log('  note  ' + msg);
}

// ───────────────────────────── listing ─────────────────────────────

const LIMITS = { title: 30, short: 80, full: 4000, whatsnew: 500 };

/** Words Google's metadata rules keep out of a listing (ranking, price, promotion, calls to action). */
const BANNED = {
  en: [
    'best', '#1', 'no. 1', 'number one', 'top', 'new', 'free', 'discount', 'sale', 'million downloads',
    'download now', 'play now', 'install now', 'app of the year', "editor's choice", 'popular', 'award',
  ],
  ar: [
    'الأفضل', 'أفضل', 'رقم 1', 'رقم واحد', '#1', 'مجان', 'جديد', 'خصم', 'تخفيض', 'عرض خاص', 'حمّل الآن', 'حمل الآن',
    'العب الآن', 'نزّل الآن', 'الأكثر', 'الأشهر', 'جائزة',
  ],
};
/**
 * Names and vocabulary of other games that must never appear in the listing. They are deliberately
 * not spelled out in this file (no other game's name is written anywhere in this project's own
 * files): the list is read from the action items of the naming research, which quotes them.
 */
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
  // never shorten the brand to its first three or four letters (naming research, second caveat)
  const shortened = /Never shorten the name to "([^"]+)" or "([^"]+)"/.exec(text);
  if (shortened) add(shortened[1] + ',' + shortened[2]);
  return out.size ? Array.from(out) : null;
}
const OTHER_GAMES = otherGamesVocabulary();

function countChars(text) {
  return { points: Array.from(text).length, units: text.length };
}

function wordHit(text, word) {
  const lower = text.toLowerCase();
  const w = word.toLowerCase();
  if (/^[a-z]/.test(w) && /[a-z]$/.test(w)) return new RegExp('(^|[^a-z])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z])').test(lower);
  return lower.indexOf(w) >= 0;
}

function checkListing(lang) {
  if (lang === 'en') {
    if (OTHER_GAMES) ok('vocabulary of other games: ' + OTHER_GAMES.length + ' words and phrases read from docs/research/naming-ip.md');
    else note('docs/research/naming-ip.md not found: the check for other games\' names and vocabulary was skipped');
  }
  const file = path.join(STORE, 'listing', lang + '.md');
  if (!fs.existsSync(file)) return fail('listing/' + lang + '.md is missing');
  let src = fs.readFileSync(file, 'utf8');
  // a field: marker, the text in a fenced block (optionally wrapped in <div dir="ltr"> so English
  // stays left-to-right inside the right-to-left page), then the counted length
  const re = /<!-- field: (\w+) \| limit: (\d+) -->\r?\n(?:<div dir="ltr">\r?\n\r?\n)?```text\r?\n([\s\S]*?)\r?\n```\r?\n(?:\r?\n<\/div>\r?\n\r?\n)?\*\*عدد الأحرف:\*\* (\d+) \/ (\d+)/g;
  const fields = {};
  let m;
  let changed = false;
  const edits = [];
  while ((m = re.exec(src))) {
    const [whole, name, limitText, body, statedText, statedLimit] = m;
    const limit = Number(limitText);
    const text = body.trim();
    const c = countChars(text);
    fields[name] = text;
    if (LIMITS[name] !== limit) fail(lang + '.' + name + ': limit written as ' + limit + ', Google Play allows ' + LIMITS[name]);
    if (c.points > limit || c.units > limit) fail(lang + '.' + name + ': ' + c.points + ' characters (' + c.units + ' UTF-16 units) is over the limit of ' + limit);
    else ok(lang + '.' + name + ': ' + c.points + ' / ' + limit + ' characters' + (c.units !== c.points ? ' (' + c.units + ' UTF-16 units)' : ''));
    if (Number(statedText) !== c.points || Number(statedLimit) !== limit) {
      if (WRITE) {
        edits.push([whole, whole.replace(/\*\*عدد الأحرف:\*\* \d+ \/ \d+$/, '**عدد الأحرف:** ' + c.points + ' / ' + limit)]);
        changed = true;
      } else {
        fail(lang + '.' + name + ': the file says ' + statedText + ' / ' + statedLimit + ' but the text has ' + c.points + ' characters (run with --write-counts)');
      }
    }
    if (body !== text) fail(lang + '.' + name + ': leading or trailing blank space inside the block');
    if (/\p{Extended_Pictographic}/u.test(text)) fail(lang + '.' + name + ': contains an emoji or pictograph');
    if (/([!?*★☆~])\1/.test(text)) fail(lang + '.' + name + ': repeated punctuation or symbols');
    const caps = text.match(/\b[A-Z]{3,}\b/g);
    if (caps) fail(lang + '.' + name + ': words in capitals: ' + caps.join(', '));
    for (const w of BANNED[lang]) if (wordHit(text, w)) fail(lang + '.' + name + ': ranking / price / promotion wording: "' + w + '"');
    for (const w of OTHER_GAMES || []) if (wordHit(text, w)) fail(lang + '.' + name + ': name or vocabulary of another game: "' + w + '"');
  }
  if (changed) {
    for (const [from, to] of edits) src = src.replace(from, to);
    fs.writeFileSync(file, src);
    console.log('  wrote counts into listing/' + lang + '.md');
  }
  for (const name of Object.keys(LIMITS)) if (!(name in fields)) fail(lang + ': field "' + name + '" not found');
  if (fields.short && fields.full && fields.full.indexOf(fields.short) >= 0) fail(lang + ': the short description is repeated inside the full description');
  if (fields.title && /[:\-–—|!]{2,}/.test(fields.title)) fail(lang + '.title: repeated special characters');
  const expectedTitle = { en: 'Zumurud: Gem Match Puzzle', ar: 'زمرد: جواهر الواحة' }[lang];
  if (fields.title && fields.title !== expectedTitle) note(lang + '.title is "' + fields.title + '" (the naming research recommends "' + expectedTitle + '")');
}

// ───────────────────────────── graphics ─────────────────────────────

function checkRgbPng(file, w, h, label) {
  if (!fs.existsSync(file)) return fail(label + ' is missing');
  const buf = fs.readFileSync(file);
  let info;
  try {
    info = pngInfo(buf);
  } catch (err) {
    return fail(label + ': ' + err.message);
  }
  const size = info.width + '×' + info.height;
  if (info.width !== w || info.height !== h) fail(label + ' is ' + size + ', must be exactly ' + w + '×' + h);
  else if (info.bitDepth !== 8 || info.colorType !== 2 || info.hasAlphaChannel) fail(label + ' must be an 8-bit RGB PNG without alpha (colour type ' + info.colorType + ', depth ' + info.bitDepth + ')');
  else ok(label + ': ' + size + ', 24-bit RGB, no alpha channel, ' + Math.round(buf.length / 1024) + ' KB');
}

/** Graphics and screenshots: the checks live in check-shots.cjs (with the screenshot tool's own config). */
function checkGraphics() {
  shots.checkGraphics(STORE, { ok, fail, note });
}

function checkScreenshots() {
  shots.checkScreenshots(STORE, { ok, fail, note });
}

// ───────────────────────────── privacy page ─────────────────────────────

async function checkPrivacy() {
  const file = path.join(STORE, 'privacy', 'index.html');
  if (!fs.existsSync(file)) return fail('privacy/index.html is missing');
  const html = fs.readFileSync(file, 'utf8');
  // static: nothing that could reach the network
  const external = html.match(/(?:src|href|action)\s*=\s*["']\s*(?:https?:)?\/\/[^"']+/gi) || [];
  const loading = external.filter((s) => !/^href/i.test(s));
  if (loading.length) fail('privacy page loads external resources: ' + loading.join(', '));
  if (/@import|url\(\s*["']?https?:/i.test(html)) fail('privacy page CSS pulls something from the network');
  if (/<link[^>]+rel=["']?(?:stylesheet|preload|preconnect|dns-prefetch|icon)/i.test(html)) fail('privacy page has a <link> that would be fetched');

  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    for (const lang of ['', 'en', 'ar']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: lang === 'ar' ? 'ar-KW' : 'en-US' });
      const page = await context.newPage();
      const problems = [];
      const requests = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error' || msg.type() === 'warning') problems.push(msg.type() + ': ' + msg.text());
      });
      page.on('pageerror', (err) => problems.push('exception: ' + err.message));
      page.on('request', (req) => requests.push(req.url()));
      const url = 'file://' + file + (lang ? '#' + lang : '');
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForTimeout(200);
      const state = await page.evaluate(() => {
        const vis = (id) => {
          const el = document.getElementById(id);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return r.height > 0 && getComputedStyle(el).display !== 'none';
        };
        const en = document.getElementById('en');
        const ar = document.getElementById('ar');
        return {
          title: document.title,
          enVisible: vis('en'),
          arVisible: vis('ar'),
          enDir: en && (en.getAttribute('dir') || ''),
          arDir: ar && (ar.getAttribute('dir') || ''),
          enLang: en && (en.getAttribute('lang') || ''),
          arLang: ar && (ar.getAttribute('lang') || ''),
          enText: en ? en.innerText.length : 0,
          arText: ar ? ar.innerText.length : 0,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          placeholders: Array.from(document.querySelectorAll('.fill')).map((e) => e.textContent.trim()),
          h1: Array.from(document.querySelectorAll('h1')).map((e) => e.textContent.trim()),
        };
      });
      const label = 'privacy page' + (lang ? ' #' + lang : '') + ' (' + (lang === 'ar' ? 'Arabic browser' : 'English browser') + ')';
      const extra = requests.filter((u) => u.split('#')[0] !== 'file://' + file);
      if (extra.length) fail(label + ': made ' + extra.length + ' network/file requests: ' + extra.slice(0, 5).join(', '));
      else ok(label + ': no request besides the page itself');
      if (problems.length) fail(label + ': ' + problems.join(' | '));
      else ok(label + ': no console errors, warnings or exceptions');
      if (state.enVisible === null || state.arVisible === null) fail(label + ': needs both #en and #ar sections');
      else {
        if (state.enDir !== 'ltr' || state.enLang !== 'en') fail(label + ': the English section must be lang="en" dir="ltr"');
        if (state.arDir !== 'rtl' || state.arLang !== 'ar') fail(label + ': the Arabic section must be lang="ar" dir="rtl"');
        if (state.enText < 1500 || state.arText < 1200) fail(label + ': a language section is suspiciously short (en ' + state.enText + ', ar ' + state.arText + ' characters)');
        const expectOnly = lang === 'ar' ? 'ar' : lang === 'en' ? 'en' : null;
        if (expectOnly === 'ar' && !(state.arVisible && !state.enVisible)) fail(label + ': #ar should show Arabic only');
        else if (expectOnly === 'en' && !(state.enVisible && !state.arVisible)) fail(label + ': #en should show English only');
        else if (!state.enVisible && !state.arVisible) fail(label + ': neither language is visible');
        else ok(label + ': visible → ' + (state.enVisible ? 'English ' : '') + (state.arVisible ? 'Arabic' : ''));
      }
      if (state.overflow) fail(label + ': the page scrolls sideways at 390 px width');
      if (!/privacy/i.test(state.title)) fail(label + ': <title> must label the page as a privacy policy');
      if (lang === '') {
        // the language switch works with the mouse and leaves no errors behind
        await page.click('[data-lang="ar"]');
        const arOnly = await page.evaluate(() => getComputedStyle(document.getElementById('ar')).display !== 'none' && getComputedStyle(document.getElementById('en')).display === 'none');
        await page.click('[data-lang="en"]');
        const enOnly = await page.evaluate(() => getComputedStyle(document.getElementById('en')).display !== 'none' && getComputedStyle(document.getElementById('ar')).display === 'none');
        if (arOnly && enOnly) ok('privacy page: the language switch shows Arabic only, then English only');
        else fail('privacy page: the language switch does not switch (ar ' + arOnly + ', en ' + enOnly + ')');
        if (state.placeholders.length) note('privacy page still has ' + state.placeholders.length + ' placeholders the owner must fill: ' + Array.from(new Set(state.placeholders)).join(' · '));
        else ok('privacy page: no owner placeholders left');
      }
      await context.close();
    }
    // no JavaScript at all: both languages must simply be readable one after the other
    const context = await browser.newContext({ viewport: { width: 390, height: 800 }, javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('file://' + file, { waitUntil: 'load' });
    const both = (await page.locator('#en').isVisible()) && (await page.locator('#ar').isVisible());
    if (both) ok('privacy page without JavaScript: both languages are shown one after the other');
    else fail('privacy page without JavaScript: a language is hidden');
    await context.close();
  } finally {
    await browser.close();
  }
}

async function main() {
  if (want('listing')) {
    console.log('listing');
    checkListing('en');
    checkListing('ar');
  }
  if (want('graphics')) {
    console.log('graphics');
    checkGraphics();
  }
  if (want('screenshots')) {
    console.log('screenshots');
    checkScreenshots();
  }
  if (want('privacy')) {
    console.log('privacy');
    await checkPrivacy();
  }
  console.log(failures ? '\ncheck-kit: ' + failures + ' problem(s)' : '\ncheck-kit: all checks passed' + (notes.length ? ' (' + notes.length + ' note(s) above)' : ''));
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error('check-kit: ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
