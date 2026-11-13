/**
 * Mechanical checks for the store screenshots and the listing graphics (the `screenshots` and
 * `graphics` groups of check-kit.cjs). Nothing here is a matter of taste.
 *
 *   checkScreenshots(store, report)   store/screenshots
 *   checkGraphics(store, report)      store/graphics
 * `report` = { ok(msg), fail(msg), note(msg) }.
 *
 * Screenshots — what is checked, per language and device class (phone, 7-inch, 10-inch tablet):
 *   files      exactly the upload files shots-config.cjs names, no stray file; Google Play's own
 *              limits on the number (2–8 per device type; tablets at least 4)
 *   format     exact pixel size (1080×1920, 1200×1920, 1600×2560), 8-bit RGB PNG with NO alpha
 *              channel and no transparency chunk, under 8 MB, longer side at most twice the shorter
 *   raw        every capture the upload files are made from: exact size, no alpha, under 8 MB
 *   untouched  every upload file still is its raw capture, only scaled: the raw capture is scaled
 *              again here (the same Lanczos filter) and compared pixel by pixel with what the upload
 *              file shows inside its frame (the rounded corners left out). Files are also compared
 *              with the checksums the tool recorded, so an edit after the fact is found.
 *   real game  the manifest says for every capture: language, level (a shipped one), seed, moment,
 *              and that no store was connected
 *   caption    2–5 words, no ranking / price / call-to-action wording, no word in capitals, no
 *              emoji, nothing from another game's vocabulary, not the developer's name; its area —
 *              measured twice: the box of the lettering as laid out, and the box of the bright
 *              lettering pixels found in the file — under 20 % of the image; the whole band above
 *              the frame is reported too
 *   alt text   at most 140 characters
 *   sheets     contact-en.png and contact-ar.png exist
 *
 * Graphics: both feature graphics exactly 1024×500, RGB without alpha; the icon exactly 512×512,
 * every pixel opaque, at most 1024 KB, and showing the same emblem as the launcher icons of the
 * Android project (android/app/src/main/res/mipmap-*).
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ROOT, pngInfo, decodePng, resizeImage } = require('./lib.cjs');
const CFG = require('./shots-config.cjs');
const { emblemDifference, ICON_MATCH_LIMIT } = require('./icon-check.cjs');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const kb = (n) => Math.round(n / 1024) + ' KB';
const pct = (v) => (100 * v).toFixed(1) + ' %';

/** Reads a PNG's header and checks size + "RGB, no alpha" + weight. Returns problems as strings. */
function formatProblems(buf, w, h, maxBytes) {
  const out = [];
  let info;
  try {
    info = pngInfo(buf);
  } catch (err) {
    return [err.message];
  }
  if (info.width !== w || info.height !== h) out.push('is ' + info.width + '×' + info.height + ', must be exactly ' + w + '×' + h);
  if (info.bitDepth !== 8 || info.colorType !== 2) out.push('must be an 8-bit RGB PNG (colour type ' + info.colorType + ', depth ' + info.bitDepth + ')');
  if (info.hasAlphaChannel) out.push('carries an alpha channel or a transparency chunk');
  if (maxBytes && buf.length > maxBytes) out.push('weighs ' + kb(buf.length) + ', the limit is ' + kb(maxBytes));
  return out;
}

function wordHit(text, word) {
  const lower = text.toLowerCase();
  const w = word.toLowerCase();
  if (/^[a-z]/.test(w) && /[a-z]$/.test(w)) return new RegExp('(^|[^a-z])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z])').test(lower);
  return lower.indexOf(w) >= 0;
}

/** Vocabulary of other games, read from the naming research (it is not spelled out in this project's own files). */
function otherGamesVocabulary() {
  const file = path.join(ROOT, 'docs', 'research', 'naming-ip.md');
  if (!fs.existsSync(file)) return [];
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
  return Array.from(out);
}

function developerName(store) {
  try {
    const owner = JSON.parse(fs.readFileSync(path.join(store, 'owner.json'), 'utf8'));
    return typeof owner.developerName === 'string' ? owner.developerName : '';
  } catch (_err) {
    return '';
  }
}

// ───────────────────────────── captions ─────────────────────────────

function checkCaptions(store, report) {
  const others = otherGamesVocabulary();
  const dev = developerName(store);
  let bad = 0;
  const problem = (msg) => {
    bad++;
    report.fail(msg);
  };
  for (const final of CFG.FINALS) {
    for (const lang of CFG.LANGS) {
      const lines = final.caption[lang];
      const text = lines.join(' ');
      const label = 'caption ' + final.n + ' (' + lang + ') "' + text + '"';
      const words = text.split(/\s+/).filter(Boolean);
      if (words.length < 2 || words.length > 5) problem(label + ': ' + words.length + ' words, must be 2–5');
      if (lines.length > 2) problem(label + ': more than two lines');
      if (/\p{Extended_Pictographic}/u.test(text)) problem(label + ': contains an emoji or pictograph');
      if (/([!?*★☆~])\1/.test(text) || /[!?]/.test(text)) problem(label + ': exclamation or question marks');
      const caps = text.match(/\b[A-Z]{2,}\b/g);
      if (caps) problem(label + ': words in capitals: ' + caps.join(', '));
      for (const w of CFG.CAPTION_BANNED[lang]) if (wordHit(text, w)) problem(label + ': ranking / price / promotion wording: "' + w + '"');
      for (const w of others) if (wordHit(text, w)) problem(label + ': name or vocabulary of another game: "' + w + '"');
      if (dev && wordHit(text, dev)) problem(label + ': carries the developer name');
      if (lang === 'ar' && !/[؀-ۿ]/.test(text)) problem(label + ': the Arabic caption has no Arabic letters');
      if (lang === 'en' && /[؀-ۿ]/.test(text)) problem(label + ': the English caption has Arabic letters');
    }
  }
  if (!bad) {
    report.ok(
      'captions: ' + CFG.FINALS.length + ' × ' + CFG.LANGS.length + ', each 2–5 words on at most two lines; no ranking, price or call-to-action wording (' +
        CFG.CAPTION_BANNED.en.length + ' English + ' + CFG.CAPTION_BANNED.ar.length + ' Arabic terms), no capitals, no emoji, nothing from another game\'s vocabulary (' + others.length + ' terms)' +
        (dev ? ', not the developer name' : ''),
    );
  }
}

// ───────────────────────────── one upload file ─────────────────────────────

/**
 * The box of the caption's lettering as found in the pixels: bright pixels (the cream and gold
 * faces of the letters) in the band above the frame. The background there never gets this bright.
 */
function captionBoxFromPixels(img, bandBottom) {
  let x0 = img.width;
  let y0 = img.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < bandBottom; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * img.channels;
      const r = img.data[i];
      const g = img.data[i + 1];
      const b = img.data[i + 2];
      // cream (#fff6dc) and gold (#ffe7a3 … #e9a93a): strong red and green
      if (r > 215 && g > 150 && r + g + b > 470) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Compares the capture shown in an upload file with its raw capture scaled the same way.
 * Returns { compared, different, worst } over the pixels inside the frame, rounded corners left out.
 */
function compareWithRaw(finalImg, rawImg, shot, radius) {
  const scaled = resizeImage(rawImg, shot.w, shot.h);
  let compared = 0;
  let different = 0;
  let worst = 0;
  const r = radius + 2;
  for (let y = 0; y < shot.h; y++) {
    for (let x = 0; x < shot.w; x++) {
      // leave the four corner squares out: the mask rounds them
      const cx = x < r ? r - x : x >= shot.w - r ? x - (shot.w - r - 1) : 0;
      const cy = y < r ? r - y : y >= shot.h - r ? y - (shot.h - r - 1) : 0;
      if (cx > 0 && cy > 0) continue;
      const i = (y * scaled.width + x) * scaled.channels;
      const j = ((shot.y + y) * finalImg.width + shot.x + x) * finalImg.channels;
      let d = 0;
      for (let c = 0; c < 3; c++) {
        const v = Math.abs(scaled.data[i + c] - finalImg.data[j + c]);
        if (v > d) d = v;
      }
      compared++;
      if (d > 0) different++;
      if (d > worst) worst = d;
    }
  }
  return { compared, different, worst };
}

// ───────────────────────────── screenshots ─────────────────────────────

function checkScreenshots(store, report) {
  const base = path.join(store, 'screenshots');
  const manifestFile = path.join(base, 'manifest.json');
  if (!fs.existsSync(manifestFile)) {
    report.note('no screenshots yet (store/screenshots/manifest.json is missing): run node tools/store/make-screenshots.cjs');
    return;
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  } catch (err) {
    report.fail('screenshots/manifest.json cannot be read: ' + err.message);
    return;
  }
  const rel = (file) => path.relative(base, file).split(path.sep).join('/');
  const levelCount = manifest.levelsInGame || 120;

  checkCaptions(store, report);

  // alt texts
  let altBad = 0;
  let altLongest = 0;
  for (const key of Object.keys(manifest.finals || {})) {
    const alt = manifest.finals[key].alt || '';
    const n = Array.from(alt).length;
    if (n > altLongest) altLongest = n;
    if (n === 0 || n > CFG.LIMITS.altMax || /\{\w+\}/.test(alt) || /\s{2,}/.test(alt)) {
      altBad++;
      report.fail('screenshots/' + key + ': alt text ' + (n === 0 ? 'is missing' : n > CFG.LIMITS.altMax ? 'has ' + n + ' characters (limit ' + CFG.LIMITS.altMax + ')' : 'has an unfilled place or a double space: "' + alt + '"'));
    }
  }
  if (!altBad) report.ok('alt texts: ' + Object.keys(manifest.finals || {}).length + ' present, the longest has ' + altLongest + ' characters (limit ' + CFG.LIMITS.altMax + ')');

  // raw captures
  const rawCache = {};
  for (const lang of CFG.LANGS) {
    for (const id of CFG.DEVICE_IDS) {
      const device = CFG.DEVICES[id];
      const dir = path.join(base, ...device.rawDir, lang);
      const expected = CFG.SCENES.filter((s) => s.devices.includes(id)).map((s) => s.file + '.png');
      const present = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.endsWith('.png')).sort() : [];
      const label = 'screenshots/' + rel(dir) + '/';
      const missing = expected.filter((n) => !present.includes(n));
      const stray = present.filter((n) => !expected.includes(n));
      if (missing.length) report.fail(label + ' is missing ' + missing.join(', '));
      if (stray.length) report.fail(label + ' has files the tool does not make: ' + stray.join(', '));
      let bad = 0;
      let heaviest = 0;
      for (const name of present) {
        const file = path.join(dir, name);
        const key = rel(file);
        const buf = fs.readFileSync(file);
        if (buf.length > heaviest) heaviest = buf.length;
        const problems = formatProblems(buf, device.width, device.height, CFG.LIMITS.maxBytes);
        const entry = (manifest.captures || {})[key];
        if (!entry) problems.push('has no entry in manifest.json (which level, seed and moment is it?)');
        else {
          if (entry.sha256 !== sha256(buf)) problems.push('is not the file the tool captured (checksum differs from manifest.json) — it was changed afterwards');
          if (entry.lang !== lang) problems.push('was captured in "' + entry.lang + '"');
          if (!entry.moment) problems.push('has no "moment" in the manifest');
          if (!/^no store connected/.test(entry.store || '')) problems.push('was not captured with the store switched off');
          const scene = CFG.SCENES.find((s) => s.file + '.png' === name);
          if (scene && scene.level) {
            if (!(Number.isInteger(entry.level) && entry.level >= 1 && entry.level <= levelCount)) problems.push('names no shipped level (level ' + entry.level + ' of ' + levelCount + ')');
            if (!Number.isInteger(entry.seed)) problems.push('names no seed');
          }
        }
        if (problems.length) {
          bad++;
          report.fail('screenshots/' + key + ' ' + problems.join('; '));
        }
        rawCache[key] = buf;
      }
      if (!bad && !missing.length && !stray.length) {
        report.ok(label + ': ' + present.length + ' captures of the real game, each exactly ' + device.width + '×' + device.height + ', RGB without alpha, the heaviest ' + kb(heaviest) + '; level, seed, moment and "no store" recorded for each');
      }
    }
  }

  // upload files
  for (const lang of CFG.LANGS) {
    for (const id of CFG.DEVICE_IDS) {
      const device = CFG.DEVICES[id];
      const dir = path.join(base, ...device.finalDir, lang);
      const label = 'screenshots/' + rel(dir) + '/';
      const expected = CFG.FINALS.map((f) => String(f.n).padStart(2, '0') + '-' + f.slug + '.png');
      const present = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => !n.startsWith('.')).sort() : [];
      const missing = expected.filter((n) => !present.includes(n));
      const stray = present.filter((n) => !expected.includes(n));
      const want = CFG.LIMITS.finals[id];
      if (present.length !== want) report.fail(label + ' has ' + present.length + ' files, the kit has ' + want);
      if (present.length < CFG.LIMITS.minFinals[id] || present.length > 8) report.fail(label + ' has ' + present.length + ' files; Google Play takes ' + CFG.LIMITS.minFinals[id] + '–8 for this device type');
      if (missing.length) report.fail(label + ' is missing ' + missing.join(', '));
      if (stray.length) report.fail(label + ' has files that do not belong there: ' + stray.join(', '));

      let bad = 0;
      let heaviest = 0;
      let captionMax = 0;
      let captionPixelsMax = 0;
      let bandMax = 0;
      let compared = 0;
      let different = 0;
      let worst = 0;
      for (const name of present.filter((n) => expected.includes(n))) {
        const file = path.join(dir, name);
        const key = rel(file);
        const buf = fs.readFileSync(file);
        if (buf.length > heaviest) heaviest = buf.length;
        const problems = formatProblems(buf, device.width, device.height, CFG.LIMITS.maxBytes);
        const longer = Math.max(device.width, device.height);
        const shorter = Math.min(device.width, device.height);
        if (longer > 2 * shorter || shorter < 320 || longer > 3840) problems.push('breaks Google Play\'s shape rule (each side 320–3840 px, the longer at most twice the shorter)');
        const entry = (manifest.finals || {})[key];
        if (!entry) {
          problems.push('has no entry in manifest.json');
        } else if (problems.length === 0) {
          if (entry.sha256 !== sha256(buf)) problems.push('is not the file the tool wrote (checksum differs from manifest.json) — it was changed afterwards');
          const rawBuf = rawCache[entry.source];
          if (!rawBuf) problems.push('names a raw capture that is not there: ' + entry.source);
          else {
            if (entry.sourceSha256 !== sha256(rawBuf)) problems.push('was laid out from another version of ' + entry.source + ' (run make-screenshots.cjs --layout)');
            const final = CFG.FINALS.find((f) => String(f.n).padStart(2, '0') + '-' + f.slug + '.png' === name);
            const wantLang = final.otherLang ? (lang === 'en' ? 'ar' : 'en') : lang;
            if (entry.sourceLang !== wantLang) problems.push('shows a capture in "' + entry.sourceLang + '", expected "' + wantLang + '"');
            if (JSON.stringify(entry.caption) !== JSON.stringify(final.caption[lang])) problems.push('carries another caption than shots-config.cjs (run make-screenshots.cjs --layout)');
            const img = decodePng(buf);
            // 1. the capture inside the frame is the raw capture, only scaled
            const cmp = compareWithRaw(img, decodePng(rawBuf), entry.shot, entry.radius);
            compared += cmp.compared;
            different += cmp.different;
            if (cmp.worst > worst) worst = cmp.worst;
            if (cmp.worst > 0) problems.push('the capture inside the frame is not its raw capture scaled: ' + cmp.different + ' of ' + cmp.compared + ' pixels differ (by up to ' + cmp.worst + ' of 255)');
            // 2. caption area, twice
            const area = device.width * device.height;
            const laid = (entry.captionBox.w * entry.captionBox.h) / area;
            const found = captionBoxFromPixels(img, entry.band);
            const seen = found ? (found.w * found.h) / area : 0;
            const band = entry.band / device.height;
            if (laid > captionMax) captionMax = laid;
            if (seen > captionPixelsMax) captionPixelsMax = seen;
            if (band > bandMax) bandMax = band;
            if (!found) problems.push('no caption lettering found above the frame');
            if (laid >= CFG.LIMITS.captionInkMax || seen >= CFG.LIMITS.captionInkMax) problems.push('the caption takes ' + pct(Math.max(laid, seen)) + ' of the image (limit ' + pct(CFG.LIMITS.captionInkMax) + ')');
            if (found && (found.x < device.width * 0.03 || found.x + found.w > device.width * 0.97 || found.y < device.width * 0.012)) problems.push('the caption runs too close to the edge (' + JSON.stringify(found) + ')');
            if (found && found.y + found.h > entry.shot.y) problems.push('the caption reaches into the capture');
          }
        }
        if (problems.length) {
          bad++;
          report.fail('screenshots/' + key + ' ' + problems.join('; '));
        }
      }
      if (!bad && !missing.length && !stray.length && present.length === want) {
        report.ok(
          label + ': ' + present.length + ' upload files, each exactly ' + device.width + '×' + device.height + ', RGB without alpha, the heaviest ' + kb(heaviest) + ' (limit ' + kb(CFG.LIMITS.maxBytes) + ')' +
            '; capture = raw capture scaled, ' + compared + ' pixels compared, ' + different + ' differ' +
            '; caption at most ' + pct(captionMax) + ' of the image as laid out, ' + pct(captionPixelsMax) + ' as found in the pixels (limit ' + pct(CFG.LIMITS.captionInkMax) + '); the whole band above the frame is ' + pct(bandMax),
        );
      }
    }
  }

  for (const lang of CFG.LANGS) {
    const sheet = path.join(base, 'contact-' + lang + '.png');
    if (!fs.existsSync(sheet)) report.fail('screenshots/contact-' + lang + '.png is missing');
    else {
      const info = pngInfo(fs.readFileSync(sheet));
      report.ok('screenshots/contact-' + lang + '.png: ' + info.width + '×' + info.height + ' (for review only, not for upload)');
    }
  }
  if (!fs.existsSync(path.join(base, 'MANIFEST.md'))) report.fail('screenshots/MANIFEST.md is missing');
  if (manifest.game) {
    report.note(
      'screenshots were captured from game version ' + manifest.game.version + ' @ ' + manifest.game.commit + (manifest.game.sourceEditedSinceCommit ? ' (+ uncommitted edits under src/)' : '') + ' on ' + manifest.capturedAt +
        ' — capture again after the last change to the game: node tools/store/make-screenshots.cjs',
    );
  }
}

// ───────────────────────────── graphics ─────────────────────────────

function checkGraphics(store, report) {
  const dir = path.join(store, 'graphics');
  for (const name of ['feature-graphic.png', 'feature-graphic-ar.png']) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) {
      report.fail('graphics/' + name + ' is missing');
      continue;
    }
    const buf = fs.readFileSync(file);
    const problems = formatProblems(buf, 1024, 500, 15 * 1024 * 1024);
    if (problems.length) report.fail('graphics/' + name + ' ' + problems.join('; '));
    else report.ok('graphics/' + name + ': 1024×500, 24-bit RGB, no alpha channel, ' + kb(buf.length));
  }

  const iconFile = path.join(dir, 'icon-512.png');
  if (!fs.existsSync(iconFile)) return report.fail('graphics/icon-512.png is missing');
  const buf = fs.readFileSync(iconFile);
  const info = pngInfo(buf);
  if (info.width !== 512 || info.height !== 512) return report.fail('graphics/icon-512.png is ' + info.width + '×' + info.height + ', must be exactly 512×512');
  if (buf.length > 1024 * 1024) report.fail('graphics/icon-512.png is ' + buf.length + ' bytes; Google Play allows at most 1024 KB');
  const icon = decodePng(buf);
  let transparent = 0;
  if (icon.channels === 4) for (let i = 3; i < icon.data.length; i += 4) if (icon.data[i] !== 255) transparent++;
  if (transparent) report.fail('graphics/icon-512.png has ' + transparent + ' pixels that are not fully opaque (transparency or rounded corners)');
  else {
    report.ok(
      'graphics/icon-512.png: 512×512, ' +
        (icon.channels === 4 ? '32-bit PNG whose alpha channel is 255 everywhere (fully opaque, square corners)' : '24-bit RGB, no alpha channel') +
        ', ' + kb(buf.length),
    );
  }

  // the same emblem as the launcher icons of the Android project
  const res = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
  const launchers = [
    ['mipmap-xxxhdpi', 'ic_launcher_foreground.png'],
    ['mipmap-xxhdpi', 'ic_launcher_foreground.png'],
    ['mipmap-xxxhdpi', 'ic_launcher.png'],
    ['mipmap-xxxhdpi', 'ic_launcher_round.png'],
  ];
  const results = [];
  let worst = 0;
  for (const [folder, name] of launchers) {
    const file = path.join(res, folder, name);
    if (!fs.existsSync(file)) continue;
    let diff = null;
    try {
      diff = emblemDifference(icon, decodePng(fs.readFileSync(file)));
    } catch (_err) {
      diff = null;
    }
    results.push(folder + '/' + name + ' ' + (diff === null ? 'not comparable' : diff.toFixed(1)));
    if (diff === null) worst = Infinity;
    else if (diff > worst) worst = diff;
  }
  if (results.length === 0) report.note('graphics/icon-512.png: no Android launcher icons found to compare with (android/app/src/main/res/mipmap-*)');
  else if (worst > ICON_MATCH_LIMIT) {
    report.fail(
      'graphics/icon-512.png does not show the same emblem as the Android launcher icons (difference of the jewel and star, 0–255: ' + results.join(', ') + '; limit ' + ICON_MATCH_LIMIT +
        ') — make both again from the current emblem: node tools/android/make-icons.cjs',
    );
  } else {
    report.ok('graphics/icon-512.png shows the same emblem as the Android launcher icons (difference of the jewel and star, 0–255: ' + results.join(', ') + '; limit ' + ICON_MATCH_LIMIT + ')');
  }
}

module.exports = { checkScreenshots, checkGraphics, compareWithRaw, captionBoxFromPixels };
