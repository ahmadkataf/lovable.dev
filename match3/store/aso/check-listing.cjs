/**
 * Counts, policy checks and the paste-ready JSON for the Google Play listing texts.
 *
 *   node store/aso/check-listing.cjs                 check everything; exit code 1 if anything fails
 *   node store/aso/check-listing.cjs --write         first rewrite the "عدد الأحرف: N / L" line under every
 *                                                    text block and regenerate store/listing/fields.json
 *   node store/aso/check-listing.cjs --cross-check   also run the kit's own checker on the listing
 *                                                    (tools/store/check-kit.cjs listing), unmodified
 *   STORE_DIR=<dir> node store/aso/check-listing.cjs check a copy of store/ somewhere else (used to prove
 *                                                    that the checks really fail on a broken text)
 *
 * One authoritative set of texts
 *   store/listing/en-US.md and store/listing/ar.md hold the final texts, one fenced block per Play
 *   Console field. store/listing/fields.json is GENERATED from them by --write and is checked to be
 *   identical on every run, so the Markdown and the JSON cannot drift apart.
 *   store/listing/*-variants.md hold the A/B candidates (counted and checked the same way).
 *
 * Block markers (the `field` form is the one tools/store/check-kit.cjs reads as well)
 *   <!-- field: title | limit: 30 -->                       title | short | full | whatsnew
 *   <!-- alt: full-without-ads | replaces-section: "…" | limit: 4000 -->
 *                                                           a replacement for one section of the full
 *                                                           description (heading line + its paragraph),
 *                                                           for the build flavour that carries no ads
 *   <!-- variant: short-B | kind: short | limit: 80 -->     an experiment candidate
 *   each followed by a ```text block and the line  **عدد الأحرف:** N / L
 *
 * What is checked (every rule is taken from Google's own pages, see store/aso/KEYWORDS.md §8)
 *   limits        title 30, short description 80, full description 4000, release notes 500 — counted
 *                 in Unicode code points AND UTF-16 units (the stricter reading), graphemes reported
 *   hygiene       NFC, no tabs / CR / double spaces / trailing spaces / invisible or bidi-control
 *                 characters, at most one blank line in a row
 *   plain text    Play shows every field as plain text: no Markdown (**bold**, _italic_, # heading, `code`,
 *                 [link](…), "- " or "1. " list markers, > quote), no HTML tag or entity, no backslash escape
 *   metadata      no emoji or pictograph, no ★/☆, no repeated punctuation, no word in capitals, no
 *                 ranking / price / promotion / call-to-action wording, no comparison wording, no year numbers
 *   vocabulary    ar: one word per concept, the game's own (src/i18n/strings/common.ts): مرحلة not مستوى,
 *                 قلوب not أرواح, حركة not نقلة, جوهرة for a piece (never عنصر, and never a bare حجر, which
 *                 is the stone blocker)
 *   other games   no name or vocabulary of any other game, app or brand: the list is read from
 *                 docs/research/naming-ip.md and from the never-use block of store/aso/KEYWORDS.md
 *                 (this script itself spells none of them); rows of type `owner` are claims that need
 *                 the owner's yes and are tolerated only in a variant marked `owner: confirm`
 *   title         brand word first, a descriptive tail, never a shortened brand
 *   short         one line; a final period only when it has more than one sentence; not repeated
 *                 inside the full description
 *   language      en-US: Latin script, US spelling. ar: Arabic punctuation, Western digits, no
 *                 tatweel, only the allowed Latin words, no diacritics in the title and the short
 *                 description, and never a diacritic on a search keyword
 *   keywords      the plan in the keyword-plan block of KEYWORDS.md: each term is used between its
 *                 minimum and maximum, the marked ones inside the first 160 characters, the Arabic
 *                 ones at least once as a clean word (no attached و / ب / ل); nothing is repeated
 *                 beyond 3 % of the words
 *   truth         every number and name the texts state is compared with the game's own source
 *                 (src/state/econ.ts, src/i18n/strings/common.ts, src/monetize/catalog.ts — read only)
 *   json          fields.json parses, has exactly the expected keys and equals the Markdown
 *   one set       store/listing/en.md, if it still exists, must be the same file as en-US.md (an alias),
 *                 never a second copy
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const STORE = process.env.STORE_DIR ? path.resolve(process.env.STORE_DIR) : path.join(ROOT, 'store');
const LISTING = path.join(STORE, 'listing');
const KEYWORDS_FILE = path.join(STORE, 'aso', 'KEYWORDS.md');
const FIELDS_JSON = path.join(LISTING, 'fields.json');
const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const CROSS = args.includes('--cross-check');
const QUIET = args.includes('--quiet');

const LOCALES = [
  { locale: 'en-US', lang: 'en', file: 'en-US.md', variants: 'en-US-variants.md', brand: 'Zumurud' },
  { locale: 'ar', lang: 'ar', file: 'ar.md', variants: 'ar-variants.md', brand: 'زمرد' },
];
const LIMITS = { title: 30, short: 80, full: 4000, whatsnew: 500 };
const JSON_KEY = { title: 'title', short: 'shortDescription', full: 'fullDescription', whatsnew: 'releaseNotes' };
/** Characters of the full description that Play shows before the reader has to expand it (see KEYWORDS.md). */
const FOLD = 160;
/** No tracked term may make up more than this share of the words of a description. */
const MAX_DENSITY = 0.03;

let failures = 0;
const notes = [];
function ok(msg) {
  if (!QUIET) console.log('  ok    ' + msg);
}
function fail(msg) {
  failures++;
  console.log('  FAIL  ' + msg);
}
function note(msg) {
  notes.push(msg);
  console.log('  note  ' + msg);
}
function head(msg) {
  console.log(msg);
}

// ───────────────────────────── text helpers ─────────────────────────────

const AR_MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g; // harakat, shadda, tanwin, Quranic marks
const AR_LETTER = '\\u0621-\\u064A\\u066E-\\u06D3';
const graphemes = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('und', { granularity: 'grapheme' }) : null;

function counts(text) {
  return {
    points: Array.from(text).length,
    units: text.length,
    graphemes: graphemes ? Array.from(graphemes.segment(text)).length : null,
    bytes: Buffer.byteLength(text, 'utf8'),
  };
}

/** Arabic folded for matching: no marks, no tatweel, one alef, ى → ي. Latin is lower-cased. */
function fold(text) {
  return text
    .normalize('NFC')
    .replace(AR_MARKS, '')
    .replace(/\u0640/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .toLowerCase();
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A Latin word or phrase as a whole word; anything else (Arabic, symbols) as a folded substring. */
function hit(text, term) {
  const t = fold(term);
  const hay = fold(text);
  if (/^[a-z0-9]/.test(t) && /[a-z0-9]$/.test(t)) return new RegExp('(^|[^a-z0-9])' + escapeRe(t).replace(/ /g, '[ -]') + '($|[^a-z0-9])').test(hay);
  return hay.indexOf(t) >= 0;
}

function words(text) {
  return text
    .replace(/[•\-–—:;,.!?()«»"“”،؛؟…]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** How often a term occurs (Latin: whole words, hyphen = space; Arabic: folded, optional one-letter prefix or ال). */
function occurrences(text, term, lang, cleanOnly) {
  const hay = fold(text);
  const t = fold(term);
  let re;
  if (lang === 'en') {
    re = new RegExp('(?<![a-z0-9])' + escapeRe(t).replace(/ /g, '[ -]') + '(?:s|es)?(?![a-z0-9])', 'g');
  } else if (cleanOnly) {
    re = new RegExp('(?<![' + AR_LETTER + '])' + escapeRe(t) + '(?![' + AR_LETTER + '])', 'g');
  } else {
    // the same word behind an attached conjunction / preposition and/or the article
    re = new RegExp('(?<![' + AR_LETTER + '])(?:[وفبلك]{0,2})(?:ال)?' + escapeRe(t) + '(?![' + AR_LETTER + '])', 'g');
  }
  return (hay.match(re) || []).length;
}

// ───────────────────────────── the lists ─────────────────────────────

/** Ranking, price, promotion, call-to-action and time-sensitive wording (Google's metadata guidance). */
const BANNED = {
  en: [
    'best', '#1', 'no. 1', 'number one', 'top', 'new', 'free', 'discount', 'sale', 'million downloads', 'download now',
    'play now', 'install now', 'try now', 'app of the year', "editor's choice", 'editors choice', 'popular', 'award', 'awards',
    'award-winning', 'top rated', 'trending', 'hottest', 'cheapest', 'limited time', 'today only', 'hurry', 'guaranteed',
    'no ads', 'ad-free', 'ad free', 'must-have', 'official', 'greatest', 'ultimate', 'addictive', 'addicting',
  ],
  ar: [
    'الأفضل', 'أفضل', 'رقم 1', 'رقم واحد', '#1', 'مجان', 'جديد', 'خصم', 'تخفيض', 'عرض خاص', 'حمل الآن', 'العب الآن',
    'نزل الآن', 'ثبت الآن', 'جرب الآن', 'الأكثر', 'الأشهر', 'جائزة', 'حصري', 'لفترة محدودة', 'بدون إعلانات', 'بلا إعلانات',
    'مضمون', 'الأقوى', 'الأجمل', 'الأروع', 'الأحلى', 'إدمان', 'الرسمية', 'الرسمي',
  ],
};

/**
 * Wording that compares the game with another one, whatever name follows ("Don't compare your app or
 * game to other apps or games" — Google's store listing guidance).
 */
const COMPARISON = {
  en: ['better than', 'just like', 'similar to', 'inspired by', 'alternative to', 'as good as', 'clone'],
  // on the folded text, as whole words («تبديل» must not count as «بديل»)
  ar: [/(?<![ء-ي])(?:مثل|تشبه|كلعبة|شبيهة ب|على غرار|لمحبي|لعشاق) ?لعبة(?![ء-ي])/, /(?<![ء-ي])بديل(?:ة)? (?:ل|عن)/, /(?<![ء-ي])(?:احسن|اجمل|اقوي|امتع) من(?![ء-ي])/],
};

/**
 * Markdown and HTML that Play Console would show literally (the store renders plain text only).
 */
const MARKUP = [
  [/\*\*|__|~~/, '**bold**, __bold__ or ~~strike~~ markers'],
  [/(^|\n) {0,3}#{1,6} /, 'a "# " heading'],
  [/`/, 'a backtick'],
  [/\[[^\]\n]*\]\([^)\n]*\)/, 'a Markdown link'],
  [/(^|\n)\s*[-*+] /, 'a "- " / "* " list marker (the listing uses "• ")'],
  [/(^|\n)\s*\d+[.)] /, 'a numbered-list marker'],
  [/(^|\n)\s*> /, 'a "> " quote marker'],
  [/[*_]/, 'an asterisk or underscore (*italic* / _italic_ emphasis)'],
  [/<\/?[A-Za-z][^>\n]*>/, 'an HTML tag'],
  [/&(?:[a-z]+|#\d+);/i, 'an HTML entity'],
  [/\\[nrt*_#`[\]]/, 'a backslash escape'],
];

/**
 * Arabic vocabulary: one word per concept, the game's own (header of src/i18n/strings/common.ts).
 * Each row: a pattern on the folded text, and what to write instead.
 */
const AR_ONE_WORD = [
  [/مستوي(?![ء-ي])|مستويات(?! الصعوبة)/, 'a level is «مرحلة», not «مستوى» (only «مستويات الصعوبة» is allowed, for degrees of difficulty)'],
  [/ارواح/, 'lives are «قلوب», not «أرواح»'],
  [/نقلة|نقلات/, 'a move is «حركة», not «نقلة»'],
  [/عنصر|عناصر/, 'a piece is «جوهرة / قطعة», not «عنصر»'],
];
/**
 * «حجر / أحجار» on its own is the stone blocker. A gem is «جوهرة»; the word may also stand inside the
 * fixed names «الأحجار الكريمة», «حجر كريم» and «حجر القمر». So a text names the bare word at most once
 * (the goal "break the stones"); a second bare use means a gem was called a stone.
 */
const AR_STONE = /(?<![ء-ي])[وفبلك]{0,2}(?:ال)?(?:احجار|حجر)(?![ء-ي])(?! (?:الكريمة|كريمة|كريم|القمر)(?![ء-ي]))/g;

/** Function words left out of the "most repeated words" report (compared after fold()). */
const STOP_WORDS = {
  en: ['with', 'your', 'that', 'this', 'from', 'each', 'every', 'when', 'only', 'more', 'them', 'they', 'have', 'into', 'will', 'also', 'before', 'there', 'their', 'need', 'needs'],
  ar: ['علي', 'الي', 'عند', 'عبر', 'حتي', 'التي', 'الذي', 'هذه', 'هذا', 'ذلك', 'بين', 'بعد', 'قبل', 'حين', 'كلها', 'فقط', 'ايضا', 'اكثر', 'دون', 'بدون', 'شيئا', 'كل', 'مع', 'ان', 'لا', 'او'],
};

/** British spellings that do not belong in the en-US listing. */
const BRITISH = [
  'colour', 'colours', 'coloured', 'colourful', 'neighbour', 'neighbours', 'neighbouring', 'favourite', 'favourites', 'jewellery',
  'licence', 'centre', 'travelling', 'travelled', 'organise', 'recognise', 'customise', 'grey', 'programme', 'splendour', 'honour',
];

/** Latin words that may stand inside the Arabic texts: only the two letters that name the shapes of a Nova match. */
const AR_LATIN_ALLOWED = ['L', 'T'];

/**
 * Names and vocabulary of other games, apps and brands. Not spelled out here on purpose: the naming
 * research quotes them, and the never-use block of KEYWORDS.md adds what the keyword research found.
 */
function namingResearchTerms() {
  const file = path.join(ROOT, 'docs', 'research', 'naming-ip.md');
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  const out = new Set();
  const add = (chunk) => {
    for (const raw of chunk.split(/,| plus | or | and |, and the praise words | and the praise words /)) {
      const w = raw.replace(/['"`.()!]/g, '').trim().toLowerCase().replace(/^the praise words /, '');
      if (w && w.length >= 3 && w.split(' ').length <= 4) out.add(w);
    }
  };
  // same three sources as tools/store/check-kit.cjs …
  const keepOut = /^- Keep these words out of[^:]*:(.*)$/m.exec(text);
  if (keepOut) add(keepOut[1]);
  const tokens = /no third-party brand tokens \(([^)]*)\)/.exec(text);
  if (tokens) add(tokens[1]);
  const shortened = /Never shorten the name to "([^"]+)" or "([^"]+)"/.exec(text);
  if (shortened) add(shortened[1] + ',' + shortened[2]);
  // … plus the established titles the research found in the genre search (their publishers stand in brackets)
  const established = /among others:([^\n]*?)\.\s*$/m.exec((/^- \*\*Established match-3 titles[^\n]*$/m.exec(text) || [''])[0]);
  if (established) add(established[1].replace(/\([^)]*\)/g, ''));
  return out.size ? Array.from(out) : null;
}

/** ```never-use and ```keyword-plan blocks of KEYWORDS.md: "a | b | c" rows, # comments. */
function keywordsBlock(name) {
  if (!fs.existsSync(KEYWORDS_FILE)) return null;
  const text = fs.readFileSync(KEYWORDS_FILE, 'utf8');
  const m = new RegExp('```' + name + '\\r?\\n([\\s\\S]*?)\\r?\\n```').exec(text);
  if (!m) return null;
  return m[1]
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('|').map((c) => c.trim()));
}

const NAMING_TERMS = namingResearchTerms();
const NEVER_USE = keywordsBlock('never-use');
const PLAN = keywordsBlock('keyword-plan');

// ───────────────────────────── the game's own facts (read only) ─────────────────────────────

function gameFacts() {
  const read = (rel) => {
    const f = path.join(ROOT, rel);
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  };
  const econ = read('src/state/econ.ts');
  const common = read('src/i18n/strings/common.ts');
  const catalog = read('src/monetize/catalog.ts');
  if (!econ || !common || !catalog) return null;
  const num = (name) => {
    const m = new RegExp('export const ' + name + '\\s*(?::[^=]+)?=\\s*([0-9_ *]+);').exec(econ);
    if (!m) return null;
    return m[1].split('*').reduce((a, b) => a * Number(b.replace(/[_ ]/g, '')), 1);
  };
  const order = /export const BOOSTER_UNLOCK_ORDER[^=]*=\s*\[([^\]]*)\]/.exec(econ);
  const table = (lang) => {
    // the en block comes first, the ar block second
    const at = common.indexOf('\n  ' + lang + ': {');
    const end = lang === 'en' ? common.indexOf('\n  ar: {') : common.length;
    const block = common.slice(at, end);
    const get = (key) => {
      const m = new RegExp("'" + escapeRe(key) + "':\\s*'([^']*)'").exec(block);
      return m ? m[1] : null;
    };
    return {
      chapters: ['oasis', 'dunes', 'bazaar', 'palace', 'caverns', 'stars'].map((k) => get('chapter.' + k)),
      gems: [0, 1, 2, 3, 4, 5].map((i) => get('gem.' + i)),
      pieces: ['beam', 'nova', 'prism'].map((k) => get('common.piece.' + k)),
    };
  };
  const chapters = num('CHAPTER_COUNT');
  const perChapter = num('LEVELS_PER_CHAPTER');
  return {
    levels: chapters * perChapter,
    chapters,
    perChapter,
    lives: num('MAX_LIVES'),
    lifeMinutes: num('LIFE_REGEN_MS') / 60000,
    dailyDays: num('DAILY_CYCLE_DAYS'),
    boosters: order ? order[1].split(',').filter((s) => s.trim()).length : null,
    products: (catalog.match(/id: '([a-z_]+)'/g) || []).map((s) => s.slice(5, -1)),
    rewardedPlacements: (/AD_PLACEMENTS[^=]*=\s*Object\.freeze\(\[([^\]]*)\]/.exec(catalog) || ['', ''])[1].split(',').filter((s) => s.trim()).length,
    interstitials: /INTERSTITIALS_PER_DAY\s*=\s*(\d+)/.test(catalog),
    en: table('en'),
    ar: table('ar'),
  };
}

const NUMBER_WORDS = {
  en: { 3: 'three', 5: 'five', 6: 'six', 7: 'seven', 20: 'twenty' },
  ar: { 3: ['ثلاث', 'ثلاثة'], 5: ['خمسة', 'خمس'], 6: ['ستة', 'ست'], 7: ['سبعة', 'سبع'], 20: ['عشرون', 'عشرين'] },
};

// ───────────────────────────── reading the Markdown ─────────────────────────────

const BLOCK = /<!-- (field|alt|variant): ([\w-]+)((?: \| [\w-]+: (?:"[^"]*"|[^|>"]+?))*) -->\r?\n(?:<div dir="ltr">\r?\n\r?\n)?```text\r?\n([\s\S]*?)\r?\n```\r?\n(?:\r?\n<\/div>\r?\n\r?\n)?\*\*عدد الأحرف:\*\* (\d+) \/ (\d+)/g;

function readBlocks(file) {
  let src = fs.readFileSync(file, 'utf8');
  const blocks = [];
  let m;
  BLOCK.lastIndex = 0;
  while ((m = BLOCK.exec(src))) {
    const attrs = {};
    for (const part of m[3].split(' | ').filter(Boolean)) {
      const i = part.indexOf(': ');
      attrs[part.slice(0, i).trim()] = part.slice(i + 2).trim().replace(/^"|"$/g, '');
    }
    blocks.push({ type: m[1], name: m[2], attrs, body: m[4], text: m[4].trim(), stated: Number(m[5]), statedLimit: Number(m[6]), whole: m[0] });
  }
  // every marker must have been understood: a marker whose block is malformed would otherwise be skipped silently
  const markers = (src.match(/<!-- (?:field|alt|variant): /g) || []).length;
  if (markers !== blocks.length) fail(path.basename(file) + ': ' + markers + ' block markers but only ' + blocks.length + ' well-formed blocks (marker, ```text block, count line)');
  return {
    blocks,
    rewriteCounts() {
      let changed = false;
      for (const b of blocks) {
        const c = counts(b.text).points;
        const limit = Number(b.attrs.limit);
        if (b.stated !== c || b.statedLimit !== limit) {
          const to = b.whole.replace(/\*\*عدد الأحرف:\*\* \d+ \/ \d+$/, '**عدد الأحرف:** ' + c + ' / ' + limit);
          src = src.replace(b.whole, to);
          b.whole = to;
          b.stated = c;
          b.statedLimit = limit;
          changed = true;
        }
      }
      if (changed) fs.writeFileSync(file, src);
      return changed;
    },
  };
}

// ───────────────────────────── checks on one text ─────────────────────────────

function checkText(L, kind, label, text, limit, body, waiveOwnerRows) {
  const c = counts(text);
  const stats = c.points + ' / ' + limit + ' characters' + (c.units !== c.points ? ' (' + c.units + ' UTF-16 units)' : '') + (c.graphemes !== null && c.graphemes !== c.points ? ', ' + c.graphemes + ' graphemes' : '') + ', ' + c.bytes + ' bytes';
  if (c.points > limit || c.units > limit) fail(label + ': ' + stats + ' — over the limit');
  else ok(label + ': ' + stats);
  if (!text) return fail(label + ': empty');

  // hygiene
  if (body !== undefined && body !== text) fail(label + ': leading or trailing blank space inside the block');
  if (text !== text.normalize('NFC')) fail(label + ': not in Unicode NFC form');
  if (/\t/.test(text)) fail(label + ': contains a tab');
  if (/\r/.test(text)) fail(label + ': contains a carriage return');
  if (/ {2,}/.test(text)) fail(label + ': two spaces in a row');
  if (/[ \u00A0]+$/m.test(text)) fail(label + ': a line ends with a space');
  if (/\n{3,}/.test(text)) fail(label + ': more than one blank line in a row');
  const invisible = text.match(/[\u00A0\u00AD\u061C\u180E\u2000-\u200F\u2028-\u202F\u205F-\u2064\u2066-\u206F\u3000\uFEFF\uFFFC\uFFFD]/g);
  if (invisible) fail(label + ': invisible or bidi-control characters: ' + Array.from(new Set(invisible)).map((ch) => 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(', '));
  if (/[\u0000-\u0009\u000B-\u001F\u007F]/.test(text)) fail(label + ': control characters');
  if (kind !== 'full' && kind !== 'whatsnew' && /\n/.test(text)) fail(label + ': must be a single line');

  // plain text only: Play would show Markdown or HTML literally
  for (const [re, what] of MARKUP) if (re.test(text)) fail(label + ': markup that Google Play would show literally: ' + what);

  // metadata policy
  for (const w of COMPARISON[L.lang]) {
    const found = typeof w === 'string' ? (hit(text, w) ? w : null) : (w.exec(fold(text)) || [null])[0];
    if (found) fail(label + ': comparison wording: "' + found + '" (a listing must not compare the game with another one)');
  }
  if (/\p{Extended_Pictographic}/u.test(text)) fail(label + ': contains an emoji or pictograph');
  if (/[★☆✓✔✗✘→←♥♦♣♠©®™]/.test(text)) fail(label + ': contains a symbol (★ ☆ ✓ → ™ …)');
  if (/([!?*~.,;:،؛؟\-_=+#])\1/.test(text) || /…|\?!|!\?|؟!|!؟/.test(text)) fail(label + ': repeated punctuation or an ellipsis');
  const caps = text.match(/(?<![A-Za-z])[A-Z]{2,}(?![a-z])/g);
  if (caps) fail(label + ': words in capitals: ' + Array.from(new Set(caps)).join(', '));
  if (/(?<!\d)(?:19|20)\d\d(?!\d)/.test(text)) fail(label + ': a year number makes the text time-sensitive');
  for (const w of BANNED[L.lang]) if (hit(text, w)) fail(label + ': ranking / price / promotion wording: "' + w + '"');
  for (const w of NAMING_TERMS || []) if (hit(text, w)) fail(label + ': name or vocabulary of another game (naming research): "' + w + '"');
  for (const row of NEVER_USE || []) {
    const [term, lang] = row;
    if (row[2] === 'owner' && waiveOwnerRows) continue;
    if ((lang === 'any' || lang === L.lang) && hit(text, term)) fail(label + ': a term on the never-use list of KEYWORDS.md: "' + term + '"' + (row[2] ? ' (' + row[2] + ')' : ''));
  }

  // language
  if (L.lang === 'en') {
    if (/[\u0600-\u06FF]/.test(text)) fail(label + ': Arabic letters in the English text');
    if (/[^\u0000-\u007F•–—’‘“”é]/.test(text)) fail(label + ': unexpected non-ASCII characters: ' + Array.from(new Set(text.match(/[^\u0000-\u007F•–—’‘“”é]/g))).join(' '));
    for (const w of BRITISH) if (hit(text, w)) fail(label + ': British spelling in the en-US text: "' + w + '"');
  } else {
    if (/[\u0660-\u0669\u06F0-\u06F9]/.test(text)) fail(label + ': Arabic-Indic digits (the game and the listing use 0-9)');
    if (/\u0640/.test(text)) fail(label + ': tatweel (ـ)');
    if (/[,;?]/.test(text)) fail(label + ': Latin comma, semicolon or question mark in Arabic text (use ، ؛ ؟)');
    let latin = text;
    for (const allowed of AR_LATIN_ALLOWED.slice().sort((a, b) => b.length - a.length)) latin = latin.replace(new RegExp('(?<![A-Za-z])' + escapeRe(allowed) + '(?![A-Za-z])', 'g'), ' ');
    const stray = latin.match(/[A-Za-z]+/g);
    if (stray) fail(label + ': Latin words in the Arabic text: ' + Array.from(new Set(stray)).join(', '));
    if ((kind === 'title' || kind === 'short') && text !== text.replace(AR_MARKS, '')) fail(label + ': diacritics in a ' + kind + ' (Play search does not fold them reliably — see KEYWORDS.md §5)');
    // one word per concept, the game's own
    for (const [re, what] of AR_ONE_WORD) if (re.test(fold(text))) fail(label + ': vocabulary — ' + what);
    const bareStones = fold(text).match(AR_STONE) || [];
    if (bareStones.length > 1) fail(label + ': vocabulary — «حجر / أحجار» on its own is the stone blocker and is named ' + bareStones.length + ' times; a gem is «جوهرة» (or «الأحجار الكريمة» as a kind)');
    // a search keyword must never carry a diacritic
    const marked = text.match(new RegExp('[' + AR_LETTER + '\\u064B-\\u0652\\u0670]*[\\u064B-\\u0652\\u0670][' + AR_LETTER + '\\u064B-\\u0652\\u0670]*', 'g')) || [];
    for (const w of marked) {
      const bare = fold(w);
      for (const row of PLAN || []) {
        if (row[0] !== 'ar') continue;
        for (const piece of fold(row[1]).split(' ')) {
          if (piece.length >= 3 && new RegExp('^[وفبلك]{0,2}(?:ال)?' + escapeRe(piece) + '$').test(bare)) fail(label + ': the keyword "' + row[1] + '" is written with a diacritic ("' + w + '")');
        }
      }
    }
  }
  return c;
}

function checkTitle(L, label, text) {
  if (!text.startsWith(L.brand + ': ')) fail(label + ': the brand word must come first, followed by ": " and a descriptive tail');
  else if (text.length <= L.brand.length + 2) fail(label + ': the brand word alone is not allowed as the store title');
  if (/[:\-–—|!·•]{2,}/.test(text) || /[.!?،؛:]$/.test(text)) fail(label + ': repeated or trailing punctuation');
  if (L.lang === 'en' && /(?<![a-z])zum(?:a|ur)?(?![a-z])/i.test(text.replace(/Zumurud/g, ''))) fail(label + ': a shortened brand');
}

function sentenceCount(text) {
  // sentences end with . ! ? ؟ followed by a space or the end; a number such as "3.5" does not count
  return (text.match(/[.!?؟](?=\s|$)/g) || []).length + (/[.!?؟]$/.test(text) ? 0 : 1);
}

function checkShort(L, label, text) {
  const n = sentenceCount(text);
  if (n === 1 && /\.$/.test(text)) fail(label + ': a single sentence must not end with a period (Google: periods only when there are several sentences)');
  if (n > 1 && !/[.!?؟]$/.test(text)) fail(label + ': several sentences, so the last one needs its period too');
}

// ───────────────────────────── checks on one locale ─────────────────────────────

function checkPlan(L, fields) {
  const rows = (PLAN || []).filter((r) => r[0] === L.lang);
  if (!rows.length) return note(L.locale + ': no keyword-plan rows in KEYWORDS.md — keyword use was not checked');
  const full = fields.full;
  const total = words(full).length;
  const foldText = Array.from(full).slice(0, FOLD).join('');
  let good = 0;
  const table = [];
  for (const [, term, tier, minText, maxText, flags] of rows) {
    const min = Number(minText);
    const max = Number(maxText);
    const n = occurrences(full, term, L.lang, false);
    const share = (n * term.split(' ').length) / total;
    const inTitle = occurrences(fields.title, term, L.lang, false) > 0;
    const inShort = occurrences(fields.short, term, L.lang, false) > 0;
    const inFold = occurrences(foldText, term, L.lang, false) > 0;
    let bad = false;
    if (n < min) (bad = true), fail(L.locale + ' keyword "' + term + '" (' + tier + '): used ' + n + '× in the full description, the plan asks for at least ' + min);
    if (n > max) (bad = true), fail(L.locale + ' keyword "' + term + '" (' + tier + '): used ' + n + '× in the full description, the plan allows at most ' + max);
    if (share > MAX_DENSITY) (bad = true), fail(L.locale + ' keyword "' + term + '": ' + (share * 100).toFixed(1) + ' % of the words — reads as repetition');
    if (/fold/.test(flags || '') && !inFold) (bad = true), fail(L.locale + ' keyword "' + term + '": not inside the first ' + FOLD + ' characters of the full description');
    if (/title/.test(flags || '') && !inTitle) (bad = true), fail(L.locale + ' keyword "' + term + '": the plan puts it in the title');
    if (/short/.test(flags || '') && !inShort) (bad = true), fail(L.locale + ' keyword "' + term + '": the plan puts it in the short description');
    if (/clean/.test(flags || '') && occurrences(fields.title + '\n' + fields.short + '\n' + full, term, L.lang, true) === 0) (bad = true), fail(L.locale + ' keyword "' + term + '": never written as a clean word (always behind an attached و / ب / ل or the article)');
    if (!bad) good++;
    table.push({ term, tier, n, share, inTitle, inShort, inFold });
  }
  ok(L.locale + ': keyword plan — ' + good + ' of ' + rows.length + ' terms inside their limits; full description has ' + total + ' words');
  if (!QUIET) {
    for (const r of table) {
      console.log('          ' + (r.tier + '          ').slice(0, 10) + ' ' + r.n + '× ' + (r.share * 100).toFixed(1).padStart(4) + ' %  ' + (r.inTitle ? 'T' : '·') + (r.inShort ? 'S' : '·') + (r.inFold ? 'F' : '·') + '  ' + r.term);
    }
    console.log('          (T = in the title, S = in the short description, F = inside the first ' + FOLD + ' characters)');
  }
  // the most repeated content words, whatever the plan says
  const freq = new Map();
  const stop = STOP_WORDS[L.lang];
  for (const w of words(full)) {
    let k = fold(w).replace(/[’']s$/, '');
    if (L.lang === 'ar') k = k.replace(/^[وف]?(?:ال|لل|بال)?/, '');
    if (k.length < (L.lang === 'ar' ? 3 : 4) || stop.indexOf(k) >= 0) continue;
    freq.set(k, (freq.get(k) || 0) + 1);
  }
  const topWords = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  for (const [w, n] of topWords) if (n / total > 0.04) fail(L.locale + ': the word "' + w + '" is ' + ((n / total) * 100).toFixed(1) + ' % of the full description (' + n + '×)');
  ok(L.locale + ': most repeated words — ' + topWords.map(([w, n]) => w + ' ' + n + '× (' + ((n / total) * 100).toFixed(1) + ' %)').join(', '));
}

function checkTruth(L, fields, facts) {
  if (!facts) return note('the game sources were not found: the texts were not compared with the game');
  const all = [fields.title, fields.short, fields.full, fields.whatsnew].join('\n');
  const full = fields.full;
  let checked = 0;
  const expect = (cond, msg) => {
    checked++;
    if (!cond) fail(L.locale + ' truth: ' + msg);
  };
  // every "<number> levels" in any field is the real number of levels
  const levelRe = L.lang === 'en' ? /(\d{2,})(?: [a-z3]+){0,2} levels/gi : /(\d{2,}) (?:مرحلة|مراحل)/g;
  const stated = Array.from(all.matchAll(levelRe)).map((m) => Number(m[1]));
  expect(stated.length >= 3, 'the number of levels should be stated in the short description, the full description and the release notes');
  for (const n of stated) expect(n === facts.levels, 'the text says ' + n + ' levels, the game has ' + facts.levels);
  const word = (n) => NUMBER_WORDS[L.lang][n];
  const has = (re) => re.test(full);
  if (L.lang === 'en') {
    expect(has(new RegExp(word(facts.chapters) + ' worlds', 'i')), 'expected "' + word(facts.chapters) + ' worlds" (the game has ' + facts.chapters + ' chapters)');
    expect(has(new RegExp(word(facts.perChapter) + '(?: [a-z]+)? levels', 'i')), 'expected "' + word(facts.perChapter) + ' levels" per world');
    expect(has(new RegExp(word(facts.lives) + ' lives', 'i')), 'expected "' + word(facts.lives) + ' lives"');
    expect(has(new RegExp('every ' + facts.lifeMinutes + ' minutes')), 'expected "every ' + facts.lifeMinutes + ' minutes" for a life to return');
    expect(has(new RegExp(word(facts.dailyDays) + '-day', 'i')), 'expected a "' + word(facts.dailyDays) + '-day" daily cycle');
    expect(has(new RegExp(word(facts.boosters) + ' boosters', 'i')), 'expected "' + word(facts.boosters) + ' boosters"');
  } else {
    const any = (n, after) => word(n).some((w) => new RegExp(w + ' ' + after).test(fold(full)));
    expect(any(facts.chapters, 'عوالم'), 'expected "ستة عوالم" (the game has ' + facts.chapters + ' chapters)');
    expect(any(facts.perChapter, 'مرحلة'), 'expected "عشرين مرحلة" per world');
    expect(any(facts.lives, 'قلوب'), 'expected "خمسة قلوب"');
    expect(new RegExp('كل ' + facts.lifeMinutes + ' دقيقة').test(full), 'expected "كل ' + facts.lifeMinutes + ' دقيقة" for a life to return');
    expect(any(facts.dailyDays, 'ايام'), 'expected a daily cycle of "سبعة أيام"');
    expect(any(facts.boosters, 'معززات'), 'expected "ستة معززات"');
  }
  const names = facts[L.lang];
  for (const ch of names.chapters) expect(ch && fold(full).indexOf(fold(ch)) >= 0, 'the world "' + ch + '" (its in-game name) is missing from the full description');
  for (const g of names.gems) expect(g && fold(full).indexOf(fold(g)) >= 0, 'the gem "' + g + '" (its in-game name) is missing from the full description');
  for (const p of names.pieces) expect(p && fold(full).indexOf(fold(p)) >= 0, 'the special piece "' + p + '" (its in-game name) is missing from the full description');
  // purchases and ads the text mentions exist in the game's catalogue
  expect(facts.products.some((p) => /^coins_/.test(p)), 'coin packs are mentioned but the catalogue has none');
  expect(facts.products.indexOf('starter_pack') >= 0, 'a starter pack is mentioned but the catalogue has none');
  const mentionsAds = L.lang === 'en' ? /\bads\b/i.test(full) : /إعلانات/.test(full);
  if (mentionsAds) {
    expect(facts.products.indexOf('remove_ads') >= 0, 'an option that removes ads is mentioned but the catalogue has none');
    expect(facts.rewardedPlacements > 0 && facts.interstitials, 'ads are described but the game has no ad placements');
  }
  ok(L.locale + ': ' + checked + ' statements compared with the game sources (' + facts.levels + ' levels = ' + facts.chapters + ' × ' + facts.perChapter + ', ' + facts.lives + ' lives, ' + facts.lifeMinutes + ' min, ' + facts.dailyDays + '-day cycle, ' + facts.boosters + ' boosters, ' + names.chapters.length + ' worlds, ' + names.gems.length + ' gems, ' + names.pieces.length + ' special pieces)');
}

/** The full description with one section (heading line + the lines up to the next blank line) replaced. */
function applyAlt(full, alt, label) {
  const heading = alt.attrs['replaces-section'];
  if (!heading) return fail(label + ': needs replaces-section: "<heading line>"'), null;
  const paragraphs = full.split('\n\n');
  const at = paragraphs.findIndex((p) => p.split('\n')[0] === heading);
  if (at < 0) return fail(label + ': the full description has no section headed "' + heading + '"'), null;
  if (paragraphs.filter((p) => p.split('\n')[0] === heading).length !== 1) return fail(label + ': the heading "' + heading + '" is not unique'), null;
  paragraphs[at] = alt.text;
  return paragraphs.join('\n\n');
}

function checkLocale(L, facts, out) {
  head('\n' + L.locale + ' — store/listing/' + L.file);
  const file = path.join(LISTING, L.file);
  if (!fs.existsSync(file)) return fail('listing/' + L.file + ' is missing');
  const doc = readBlocks(file);
  if (WRITE && doc.rewriteCounts()) console.log('  wrote counts into listing/' + L.file);
  const fields = {};
  for (const b of doc.blocks.filter((x) => x.type === 'field')) {
    const label = L.locale + '.' + b.name;
    if (!(b.name in LIMITS)) {
      fail(label + ': unknown field');
      continue;
    }
    if (b.name in fields) fail(label + ': the field appears twice');
    const limit = Number(b.attrs.limit);
    if (limit !== LIMITS[b.name]) fail(label + ': limit written as ' + b.attrs.limit + ', Google Play allows ' + LIMITS[b.name]);
    checkText(L, b.name, label, b.text, LIMITS[b.name], b.body);
    if (b.stated !== counts(b.text).points || b.statedLimit !== LIMITS[b.name]) fail(label + ': the file says ' + b.stated + ' / ' + b.statedLimit + ' but the text has ' + counts(b.text).points + ' characters (run with --write)');
    fields[b.name] = b.text;
  }
  for (const name of Object.keys(LIMITS)) if (!(name in fields)) fail(L.locale + ': field "' + name + '" not found');
  if (Object.keys(fields).length !== Object.keys(LIMITS).length) return;

  checkTitle(L, L.locale + '.title', fields.title);
  checkShort(L, L.locale + '.short', fields.short);
  if (fields.full.indexOf(fields.short.replace(/\.$/, '')) >= 0) fail(L.locale + ': the short description is repeated inside the full description');
  const bullets = fields.full.split('\n').filter((l) => /^[•\-–*]/.test(l));
  const kinds = new Set(bullets.map((l) => l.slice(0, 2)));
  if (kinds.size > 1) fail(L.locale + '.full: mixed bullet styles (' + Array.from(kinds).map((k) => JSON.stringify(k)).join(', ') + ')');
  if (bullets.length < 8) fail(L.locale + '.full: fewer than 8 bullet lines — the description should be scannable');
  const paragraphs = fields.full.split('\n\n');
  const longest = paragraphs.map((p) => Math.max.apply(null, p.split('\n').map((l) => Array.from(l).length))).reduce((a, b) => Math.max(a, b), 0);
  if (longest > 520) fail(L.locale + '.full: a paragraph line of ' + longest + ' characters is too long to scan');
  ok(L.locale + '.full: ' + paragraphs.length + ' blocks, ' + bullets.length + ' bullet lines, longest line ' + longest + ' characters, opening block ' + Array.from(paragraphs[0]).length + ' characters');

  checkPlan(L, fields);
  checkTruth(L, fields, facts);

  out[L.locale] = {};
  for (const name of Object.keys(LIMITS)) out[L.locale][JSON_KEY[name]] = fields[name];
  out._counts[L.locale] = {};
  for (const name of Object.keys(LIMITS)) out._counts[L.locale][JSON_KEY[name]] = { characters: counts(fields[name]).points, limit: LIMITS[name] };

  // the section replacement for the flavour without ads
  for (const alt of doc.blocks.filter((x) => x.type === 'alt')) {
    const label = L.locale + '.alt.' + alt.name;
    const limit = Number(alt.attrs.limit);
    const replaced = applyAlt(fields.full, alt, label);
    if (!replaced) continue;
    checkText(L, 'full', label + ' (whole description after the replacement)', replaced, limit);
    if (alt.stated !== counts(alt.text).points) fail(label + ': the file says ' + alt.stated + ' but the block has ' + counts(alt.text).points + ' characters (run with --write)');
    const adWord = L.lang === 'en' ? /\bads?\b|advert/i : /إعلان/;
    if (alt.name === 'full-without-ads' && adWord.test(replaced)) fail(label + ': the description for the build without ads still mentions ads');
    if (alt.name === 'full-without-ads') {
      out.ifTheBuildHasNoAds[L.locale] = { fullDescription: replaced };
      out._counts.ifTheBuildHasNoAds[L.locale] = { fullDescription: { characters: counts(replaced).points, limit } };
    }
  }

  // experiment candidates
  const vfile = path.join(LISTING, L.variants);
  if (fs.existsSync(vfile)) {
    head('\n' + L.locale + ' — store/listing/' + L.variants);
    const vdoc = readBlocks(vfile);
    if (WRITE && vdoc.rewriteCounts()) console.log('  wrote counts into listing/' + L.variants);
    const seen = new Set();
    out.experimentCandidates[L.locale] = { title: [], shortDescription: [] };
    for (const v of vdoc.blocks) {
      const label = L.locale + '.variant.' + v.name;
      const kind = v.attrs.kind;
      if (v.type !== 'variant' || (kind !== 'title' && kind !== 'short')) {
        fail(label + ': a variants file holds only variant blocks of kind title or short');
        continue;
      }
      if (seen.has(v.name)) fail(label + ': the id is used twice');
      seen.add(v.name);
      if (Number(v.attrs.limit) !== LIMITS[kind]) fail(label + ': limit written as ' + v.attrs.limit + ', Google Play allows ' + LIMITS[kind]);
      checkText(L, kind, label, v.text, LIMITS[kind], v.body, v.attrs.owner === 'confirm');
      if (v.stated !== counts(v.text).points) fail(label + ': the file says ' + v.stated + ' but the text has ' + counts(v.text).points + ' characters (run with --write)');
      if (kind === 'title') checkTitle(L, label, v.text);
      else {
        checkShort(L, label, v.text);
        if (fields.full.indexOf(v.text.replace(/\.$/, '')) >= 0) fail(label + ': repeated inside the full description');
      }
      const current = v.text === fields[kind];
      out.experimentCandidates[L.locale][JSON_KEY[kind]].push({ id: v.name, text: v.text, characters: counts(v.text).points, isTheCurrentText: current, needsOwnerConfirmation: v.attrs.owner === 'confirm' });
    }
    const current = out.experimentCandidates[L.locale];
    for (const kind of ['title', 'short']) {
      if (!current[JSON_KEY[kind]].some((x) => x.isTheCurrentText)) fail(L.locale + ' variants: none of the ' + kind + ' candidates is the text in ' + L.file + ' (the control must be listed)');
    }
  }
}

// ───────────────────────────── fields.json ─────────────────────────────

function buildJson(out) {
  return {
    _readme: [
      'Google Play store listing texts for Zumurud (com.zumurud.game), ready to paste. Generated from store/listing/en-US.md and store/listing/ar.md by: node store/aso/check-listing.cjs --write. Do not edit by hand.',
      'Paste each string exactly as it is. "\\n" inside a string is a line break: the full description and the release notes have several lines, the title and the short description have one.',
      'Where: Play Console > Grow users > Store presence > Store listings > the default store listing (this kit\'s guides call it "Main store listing"), fields under "App details": title -> "App name", shortDescription -> "Short description", fullDescription -> "Full description". The default language is en-US.',
      'The name typed in the "Create app" dialog is the en-US title of this file. If the app was already created under another name, replace the "App name" on the store listing with this title (Play Console says of the name given at creation: "You can change this later").',
      'Every string is plain text: no Markdown, no HTML. The bullet character and the line breaks are part of the text. After pasting, compare the counter under each Play Console field with _meta.counts: the title and the short description must match exactly; a multi-line text may read slightly higher if the console counts a line break as two characters, and is still far inside its limit. A lower number means text was cut: paste again.',
      'Arabic: on the same page click "Manage translations" > "Select languages", add "Arabic - ar", Apply and Save, then paste the ar strings into the Arabic version of the same three fields.',
      'releaseNotes does not go on the store listing. It goes on the release page (Prepare release > Release notes), each language between its own tags on separate lines. releaseNotesBox is that text ready to paste; if the box shows other tags, keep the tags the box shows and paste only the notes between them.',
      'ifTheBuildHasNoAds: use these full descriptions instead ONLY when the uploaded app bundle is the flavour without the ad library (App content > Ads answered "No"). Otherwise ignore the block.',
      'experimentCandidates are NOT part of the listing: they are alternatives for later store listing experiments (see store/listing/ar-variants.md and en-US-variants.md). Entries with needsOwnerConfirmation need the owner\'s yes first.',
      'The Arabic strings are correct as stored. Inside a left-to-right text box their periods, bullets and numbers can LOOK misplaced; that is only how the box draws them. Do not reorder characters and do not add direction marks.',
      'Nothing from store/aso/KEYWORDS.md is ever typed into Play Console: Google Play has no keyword field.',
      'Not in this file: the contact e-mail, website and privacy policy URL (store/owner.json and store/listing/en-US.md section 6), the graphics (store/graphics, store/screenshots) and every App content declaration (store/PUBLISHING-GUIDE.ar.md).',
    ],
    _meta: {
      applicationId: 'com.zumurud.game',
      defaultLanguage: 'en-US',
      languages: ['en-US', 'ar'],
      limits: { title: 30, shortDescription: 80, fullDescription: 4000, releaseNotes: 500 },
      counts: {
        'en-US': out._counts['en-US'],
        ar: out._counts.ar,
        ifTheBuildHasNoAds: out._counts.ifTheBuildHasNoAds,
      },
      category: { applicationType: 'Game', category: 'Puzzle' },
      tags: tagsFromKeywords(),
      releaseNotesVersion: '1.0.0',
    },
    'en-US': out['en-US'],
    ar: out.ar,
    releaseNotesBox: '<en-US>\n' + out['en-US'].releaseNotes + '\n</en-US>\n<ar>\n' + out.ar.releaseNotes + '\n</ar>',
    ifTheBuildHasNoAds: out.ifTheBuildHasNoAds,
    experimentCandidates: out.experimentCandidates,
  };
}

/** ```play-tags block of KEYWORDS.md: priority | English label | Arabic label | note. */
function tagsFromKeywords() {
  const rows = keywordsBlock('play-tags');
  if (!rows) return null;
  return {
    maximum: 5,
    howToChoose: 'Store settings → App category → Manage tags. Pick, in this order, the first five of these that the picker really offers; never pick a tag that is not on this list.',
    inOrderOfPriority: rows.map((r) => ({ priority: Number(r[0]), label: r[1], labelInArabicConsole: r[2], note: r[3] || '' })),
  };
}

function checkJson(out) {
  head('\nstore/listing/fields.json');
  const complete = out['en-US'] && out.ar;
  if (!complete) return fail('fields.json was not built: a listing file is incomplete');
  const built = buildJson(out);
  const text = JSON.stringify(built, null, 2) + '\n';
  if (WRITE) {
    fs.writeFileSync(FIELDS_JSON, text);
    console.log('  wrote listing/fields.json');
  }
  if (!fs.existsSync(FIELDS_JSON)) return fail('listing/fields.json is missing (run with --write)');
  const raw = fs.readFileSync(FIELDS_JSON, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return fail('listing/fields.json is not valid JSON: ' + err.message);
  }
  ok('fields.json parses as JSON (' + Buffer.byteLength(raw, 'utf8') + ' bytes, UTF-8' + (raw.charCodeAt(0) === 0xfeff ? ', WITH a byte-order mark' : ', no byte-order mark') + ')');
  if (raw.charCodeAt(0) === 0xfeff) fail('fields.json starts with a byte-order mark');
  if (/\r/.test(raw)) fail('fields.json contains carriage returns');
  for (const L of LOCALES) {
    const got = parsed[L.locale];
    const keys = got && typeof got === 'object' ? Object.keys(got).sort().join(',') : '';
    if (keys !== 'fullDescription,releaseNotes,shortDescription,title') {
      fail('fields.json["' + L.locale + '"] must have exactly title, shortDescription, fullDescription, releaseNotes (has: ' + (keys || 'nothing') + ')');
      continue;
    }
    for (const k of Object.keys(got)) {
      if (typeof got[k] !== 'string' || !got[k]) fail('fields.json["' + L.locale + '"].' + k + ' must be a non-empty string');
      else if (got[k] !== out[L.locale][k]) fail('fields.json["' + L.locale + '"].' + k + ' differs from listing/' + L.file + ' (run with --write)');
    }
  }
  if (JSON.stringify(parsed) !== JSON.stringify(built)) fail('fields.json is not what the Markdown files generate (run with --write)');
  else ok('fields.json is identical to what en-US.md, ar.md, the variants files and KEYWORDS.md generate (' + ['en-US', 'ar'].map((l) => l + ': ' + Object.keys(parsed[l]).length + ' strings').join(', ') + ')');
}

/** KEYWORDS.md section 1 quotes each title and short description with its count: it must not go stale. */
function checkKeywordsSummary(out) {
  head('\nstore/aso/KEYWORDS.md');
  if (!fs.existsSync(KEYWORDS_FILE)) return fail('store/aso/KEYWORDS.md is missing');
  const text = fs.readFileSync(KEYWORDS_FILE, 'utf8');
  let quoted = 0;
  for (const L of LOCALES) {
    if (!out[L.locale]) continue;
    for (const key of ['title', 'shortDescription']) {
      const value = out[L.locale][key];
      const limit = key === 'title' ? LIMITS.title : LIMITS.short;
      // the summary row reads:  `<text>` — N / L   (an English text is wrapped in a <span dir="ltr">)
      const needle = '`' + value + '`';
      let stated = null;
      for (let at = text.indexOf(needle); at >= 0 && !stated; at = text.indexOf(needle, at + 1)) {
        stated = /^(?:<\/span>)? — (\d+) \/ (\d+)/.exec(text.slice(at + needle.length, at + needle.length + 24));
      }
      if (!stated) fail('KEYWORDS.md does not quote the current ' + L.locale + ' ' + key + ' with its length ("' + value + '")');
      else if (Number(stated[1]) !== counts(value).points || Number(stated[2]) !== limit) fail('KEYWORDS.md states ' + stated[1] + ' / ' + stated[2] + ' for the ' + L.locale + ' ' + key + ', the text has ' + counts(value).points + ' / ' + limit);
      else quoted++;
    }
  }
  if (quoted === 4) ok('the summary table quotes the 2 titles and 2 short descriptions exactly, with the counted lengths');
}

function checkOneSet() {
  head('\none authoritative set');
  const old = path.join(LISTING, 'en.md');
  let stat = null;
  try {
    stat = fs.lstatSync(old);
  } catch (err) {
    stat = null;
  }
  if (!stat) return ok('listing/en.md does not exist; the English texts live only in listing/en-US.md');
  const same = fs.existsSync(old) && fs.realpathSync(old) === fs.realpathSync(path.join(LISTING, 'en-US.md'));
  if (stat.isSymbolicLink() && same) ok('listing/en.md is an alias (symbolic link) of listing/en-US.md, kept for tools and guides that still use the old name — one file, not a copy');
  else fail('listing/en.md is a separate file: delete it, or make it a symbolic link to en-US.md, so that there is exactly one English text');
}

function crossCheck() {
  head('\ncross-check with tools/store/check-kit.cjs (unmodified)');
  const kit = path.join(ROOT, 'tools', 'store', 'check-kit.cjs');
  if (!fs.existsSync(kit)) return note('tools/store/check-kit.cjs not found');
  const res = spawnSync(process.execPath, [kit, 'listing'], { cwd: ROOT, encoding: 'utf8', env: Object.assign({}, process.env, { STORE_DIR: STORE }) });
  const lines = (res.stdout || '').split('\n').filter(Boolean);
  const oks = lines.filter((l) => /^ {2}ok /.test(l)).length;
  const fails = lines.filter((l) => /^ {2}FAIL /.test(l));
  for (const l of lines.filter((l) => /^ {2}(FAIL|note) /.test(l))) console.log('    ' + l.trim());
  if (res.status === 0) ok('check-kit.cjs listing: exit code 0, ' + oks + ' checks ok, 0 failed');
  else fail('check-kit.cjs listing: exit code ' + res.status + ', ' + fails.length + ' failed');
}

function main() {
  head('lists');
  if (NAMING_TERMS) ok(NAMING_TERMS.length + ' names and words of other games read from docs/research/naming-ip.md');
  else fail('docs/research/naming-ip.md not found: the names of other games could not be checked');
  if (NEVER_USE) ok(NEVER_USE.length + ' never-use terms read from store/aso/KEYWORDS.md (' + NEVER_USE.filter((r) => r[2] === 'brand').length + ' brand, ' + NEVER_USE.filter((r) => r[2] !== 'brand').length + ' policy or truth)');
  else fail('store/aso/KEYWORDS.md has no never-use block');
  if (PLAN) ok(PLAN.length + ' keyword-plan rows read from store/aso/KEYWORDS.md (' + PLAN.filter((r) => r[0] === 'en').length + ' English, ' + PLAN.filter((r) => r[0] === 'ar').length + ' Arabic)');
  else fail('store/aso/KEYWORDS.md has no keyword-plan block');
  ok(BANNED.en.length + ' English and ' + BANNED.ar.length + ' Arabic ranking / price / promotion / call-to-action expressions');
  // a term must not sit on the plan and on the never-use list at once
  for (const row of PLAN || []) for (const never of NEVER_USE || []) if ((never[1] === 'any' || never[1] === row[0]) && hit(row[1], never[0])) fail('KEYWORDS.md: the planned keyword "' + row[1] + '" contains the never-use term "' + never[0] + '"');
  for (const row of PLAN || []) for (const w of NAMING_TERMS || []) if (row[0] === 'en' && hit(row[1], w)) fail('KEYWORDS.md: the planned keyword "' + row[1] + '" contains "' + w + '" from the naming research');

  const facts = gameFacts();
  const out = { _counts: { ifTheBuildHasNoAds: {} }, ifTheBuildHasNoAds: {}, experimentCandidates: {} };
  for (const L of LOCALES) checkLocale(L, facts, out);
  checkJson(out);
  checkKeywordsSummary(out);
  checkOneSet();
  if (CROSS) crossCheck();

  console.log(failures ? '\ncheck-listing: ' + failures + ' problem(s)' : '\ncheck-listing: all checks passed' + (notes.length ? ' (' + notes.length + ' note(s) above)' : ''));
  process.exit(failures ? 1 : 0);
}

main();
