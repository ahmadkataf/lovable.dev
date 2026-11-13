/**
 * Proof that store/aso/check-listing.cjs really fails on a broken listing.
 *
 *   node store/aso/selftest.cjs
 *
 * Each case copies store/listing and store/aso/KEYWORDS.md into a temporary folder, breaks ONE
 * thing, runs the checker on the copy (STORE_DIR) and expects exit code 1 together with the message
 * of the rule that was broken. The real files are never touched. The first case runs the checker on
 * an unbroken copy and expects exit code 0.
 *
 * No name of another game is written in this file: the two cases that need one take it from the
 * lists the checker itself reads (docs/research/naming-ip.md and the never-use block of KEYWORDS.md).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const CHECKER = path.join(__dirname, 'check-listing.cjs');

function freshCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zumurud-listing-selftest-'));
  fs.cpSync(path.join(ROOT, 'store', 'listing'), path.join(dir, 'listing'), { recursive: true, verbatimSymlinks: true });
  fs.mkdirSync(path.join(dir, 'aso'));
  fs.copyFileSync(path.join(ROOT, 'store', 'aso', 'KEYWORDS.md'), path.join(dir, 'aso', 'KEYWORDS.md'));
  return dir;
}

function run(dir, write) {
  const res = spawnSync(process.execPath, [CHECKER].concat(write ? ['--write'] : []), { cwd: ROOT, encoding: 'utf8', env: Object.assign({}, process.env, { STORE_DIR: dir }) });
  return { code: res.status, out: (res.stdout || '') + (res.stderr || '') };
}

/** Replace exactly one occurrence, or throw: a case that silently changes nothing would prove nothing. */
function edit(dir, rel, from, to) {
  const file = path.join(dir, rel);
  const src = fs.readFileSync(file, 'utf8');
  const at = src.indexOf(from);
  if (at < 0) throw new Error('selftest: "' + from.slice(0, 50) + '" not found in ' + rel + ' — update the case to the current text');
  fs.writeFileSync(file, src.slice(0, at) + to + src.slice(at + from.length));
}

/** The text of one field block of a listing file. */
function field(dir, rel, name) {
  const src = fs.readFileSync(path.join(dir, rel), 'utf8');
  const m = new RegExp('<!-- field: ' + name + ' \\| limit: \\d+ -->\\n(?:<div dir="ltr">\\n\\n)?```text\\n([\\s\\S]*?)\\n```').exec(src);
  if (!m) throw new Error('selftest: field ' + name + ' not found in ' + rel);
  return m[1];
}

/** Change one field block: fn(text) → new text. */
function editField(dir, rel, name, fn) {
  const old = field(dir, rel, name);
  edit(dir, rel, '```text\n' + old + '\n```', '```text\n' + fn(old) + '\n```');
}

function namingTerm() {
  const text = fs.readFileSync(path.join(ROOT, 'docs', 'research', 'naming-ip.md'), 'utf8');
  return /^- Keep these words out of[^:]*:\s*([a-z]+)/m.exec(text)[1];
}

function neverUseTerm(dir, lang, type) {
  const text = fs.readFileSync(path.join(dir, 'aso', 'KEYWORDS.md'), 'utf8');
  const rows = /```never-use\n([\s\S]*?)\n```/.exec(text)[1].split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split('|').map((c) => c.trim()));
  return rows.find((r) => r[1] === lang && r[2] === type)[0];
}

const EN = 'listing/en-US.md';
const AR = 'listing/ar.md';
const KASRA = String.fromCharCode(0x650);
const RLM = String.fromCharCode(0x200f);
const GEM_EMOJI = String.fromCodePoint(0x1f48e);
const INDIC_30 = String.fromCharCode(0x663, 0x660);

const CASES = [
  { name: 'unbroken copy', write: false, expectCode: 0, expect: 'all checks passed', break() {} },

  // limits and counting
  { name: 'title longer than 30 characters', expect: 'over the limit', break: (d) => editField(d, EN, 'title', (t) => t + ' Game') },
  { name: 'experiment candidate longer than its limit', expect: 'over the limit', break: (d) => edit(d, 'listing/ar-variants.md', 'زمرد: لعبة جواهر بدون نت', 'زمرد: لعبة جواهر وألغاز بدون نت') },
  { name: 'count line out of date (run without --write)', write: false, expect: 'the file says 26', break: (d) => edit(d, EN, '27 / 30', '26 / 30') },

  // metadata policy
  { name: 'emoji in the short description', expect: 'emoji or pictograph', break: (d) => editField(d, EN, 'short', (t) => t.replace('Match 3 jewels', 'Match 3 jewels ' + GEM_EMOJI)) },
  { name: 'price word in the full description', expect: 'promotion wording: "free"', break: (d) => editField(d, EN, 'full', (t) => t.replace('Zumurud is an offline', 'Zumurud is a free offline')) },
  { name: 'ranking word in the Arabic short description', expect: 'promotion wording', break: (d) => editField(d, AR, 'short', (t) => t.replace('لعبة مجوهرات', 'أفضل لعبة')) },
  { name: 'word in capitals', expect: 'words in capitals', break: (d) => editField(d, EN, 'full', (t) => t.replace('Swap gems to match three', 'SWAP gems to match three')) },
  { name: 'repeated punctuation', expect: 'repeated punctuation', break: (d) => editField(d, EN, 'whatsnew', (t) => t.replace('desert oasis.', 'desert oasis!!')) },
  { name: 'year number', expect: 'year number', break: (d) => editField(d, EN, 'whatsnew', (t) => t.replace('Welcome to Zumurud,', 'Welcome to Zumurud 2026,')) },
  { name: 'short description: one sentence ending with a period', expect: 'must not end with a period', break: (d) => editField(d, EN, 'short', (t) => t + '.') },
  { name: 'short description repeated in the full description', expect: 'repeated inside the full description', break: (d) => { const s = field(d, EN, 'short'); editField(d, EN, 'full', (t) => s + '. ' + t); } },
  { name: 'title without the brand word first', expect: 'brand word must come first', break: (d) => editField(d, EN, 'title', () => 'Gem Match 3 Puzzle: Zumurud') },

  // other games, never-use list
  { name: 'a word of another game (naming research)', expect: 'naming research', break: (d) => editField(d, EN, 'full', (t) => t.replace('How to play', 'A ' + namingTerm() + ' game.\n\nHow to play')) },
  { name: 'a name on the never-use list of KEYWORDS.md', expect: 'never-use list', break: (d) => editField(d, EN, 'full', (t) => t.replace('How to play', 'Better than ' + neverUseTerm(d, 'en', 'brand') + '.\n\nHow to play')) },
  { name: 'a claim that needs the owner (Arabic short description)', expect: 'never-use list', break: (d) => editField(d, AR, 'short', (t) => t.replace('لعبة مجوهرات', 'لعبة عربية')) },
  { name: 'something the game does not have', expect: 'never-use list', break: (d) => editField(d, EN, 'full', (t) => t.replace('Ruby, amber,', 'Diamond, ruby, amber,')) },

  // language rules
  { name: 'British spelling in en-US', expect: 'British spelling', break: (d) => editField(d, EN, 'full', (t) => t.replace('every gem of that color', 'every gem of that colour')) },
  { name: 'Arabic: diacritic on a search keyword', expect: 'written with a diacritic', break: (d) => editField(d, AR, 'full', (t) => t.replace('جمع جواهر من لون', 'جمع جواه' + KASRA + 'ر من لون')) },
  { name: 'Arabic: diacritic in the short description', expect: 'diacritics in a short', break: (d) => editField(d, AR, 'short', (t) => t.replace('واعبر', 'واعب' + KASRA + 'ر')) },
  { name: 'Arabic: Latin comma', expect: 'Latin comma', break: (d) => editField(d, AR, 'full', (t) => t.replace('الواحة، الكثبان', 'الواحة, الكثبان')) },
  { name: 'Arabic: Arabic-Indic digits', expect: 'Arabic-Indic digits', break: (d) => editField(d, AR, 'full', (t) => t.replace('كل 30 دقيقة', 'كل ' + INDIC_30 + ' دقيقة')) },
  { name: 'Arabic: invisible direction mark', expect: 'invisible or bidi-control', break: (d) => editField(d, AR, 'title', (t) => t.replace('زمرد:', 'زمرد:' + RLM)) },
  { name: 'Arabic: Latin word', expect: 'Latin words in the Arabic text', break: (d) => editField(d, AR, 'full', (t) => t.replace('واي فاي', 'Wi-Fi')) },

  // keyword plan
  { name: 'keyword repeated beyond the plan', expect: 'the plan allows at most', break: (d) => editField(d, EN, 'full', (t) => t.replace('How to play', 'Match 3 fun, match 3 gems, match 3 levels.\n\nHow to play')) },
  { name: 'primary keyword missing from the first 160 characters', expect: 'not inside the first 160 characters', break: (d) => editField(d, EN, 'full', (t) => t.replace('Zumurud is an offline match 3 puzzle game set', 'Zumurud is a game set')) },
  { name: 'Arabic keyword only behind an attached conjunction', expect: 'never written as a clean word', break: (d) => editField(d, AR, 'full', (t) => t.replace('مراحل تتدرج', 'ومراحل تتدرج')) },
  { name: 'KEYWORDS.md summary no longer matches the title', expect: 'does not quote the current en-US title', break: (d) => editField(d, EN, 'title', () => 'Zumurud: Gem Match Puzzle') },

  // truth
  { name: 'wrong number of levels', expect: 'the game has 120', break: (d) => editField(d, EN, 'short', (t) => t.replace('120', '150')) },
  { name: 'a world missing from the description', expect: 'is missing from the full description', break: (d) => editField(d, EN, 'full', (t) => t.replace('Oasis, Dunes, Bazaar, Palace', 'Oasis, Dunes, Palace')) },
  { name: 'wrong number of lives (Arabic)', expect: 'expected "خمسة قلوب"', break: (d) => editField(d, AR, 'full', (t) => t.replace('خمسة قلوب', 'سبعة قلوب')) },
  { name: 'the text for the build without ads still mentions ads', expect: 'still mentions ads', break: (d) => edit(d, EN, 'only purchases do.', 'only purchases do. There are no ads.') },

  // json and the single set
  { name: 'fields.json out of date (run without --write)', write: false, expect: 'differs from listing/en-US.md', break: (d) => edit(d, 'listing/fields.json', 'playable offline"', 'playable offline!"') },
  { name: 'fields.json is not valid JSON', write: false, expect: 'not valid JSON', break: (d) => { const f = path.join(d, 'listing', 'fields.json'); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').slice(0, -3)); } },
  { name: 'a second copy of the English text', expect: 'separate file', break: (d) => { const f = path.join(d, 'listing', 'en.md'); fs.rmSync(f, { force: true }); fs.copyFileSync(path.join(d, 'listing', 'en-US.md'), f); } },
];

let caught = 0;
const problems = [];
for (const c of CASES) {
  const dir = freshCopy();
  try {
    c.break(dir);
    const res = run(dir, c.write !== false);
    const wantCode = c.expectCode === undefined ? 1 : c.expectCode;
    const good = res.code === wantCode && res.out.indexOf(c.expect) >= 0;
    if (good) caught++;
    else problems.push(c.name + ' → exit code ' + res.code + (res.out.indexOf(c.expect) >= 0 ? '' : ', message "' + c.expect + '" not printed'));
    console.log((good ? '  ok    ' : '  FAIL  ') + c.name + (wantCode === 1 ? ' → rejected' : ' → accepted') + (good ? '' : '  (exit code ' + res.code + ')'));
  } catch (err) {
    problems.push(c.name + ' → ' + err.message);
    console.log('  FAIL  ' + c.name + ' → ' + err.message);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
console.log(problems.length ? '\nselftest: ' + problems.length + ' case(s) did not behave as expected' : '\nselftest: ' + (caught - 1) + ' of ' + (CASES.length - 1) + ' broken texts were rejected, and the unbroken copy was accepted');
process.exit(problems.length ? 1 : 0);
