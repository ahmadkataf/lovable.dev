#!/usr/bin/env node
/**
 * Builds store/play-console.json (machine-readable Play Console values for Zumurud) and fills the
 * generated tables of store/UPLOAD-RUNBOOK.md, then validates both.
 *
 *   node store/build-play-console.cjs           write play-console.json + runbook tables, then check
 *   node store/build-play-console.cjs --check   only check (exit 1 if a file is stale or missing)
 *
 * Sources it reads (never edits): store/listing/fields.json (listing texts, tags; authoritative),
 * store/owner.json (developer name, URLs, AdMob ids), store/screenshots/manifest.json (alt texts),
 * android/gradle.properties (versionCode / versionName). Products, questionnaire answers and the
 * Data safety table are declared below (from docs/DESIGN.md §7 and store/PUBLISHING-GUIDE.ar.md §6).
 *
 * Checks: the JSON parses; every store asset it names exists on disk with the right pixel size;
 * listing strings are identical to fields.json; the runbook's generated tables are up to date.
 * Release files (the .aab) are produced by the build engineer; a missing one is reported as
 * "pending", not as a failure.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const STORE = __dirname;
const MATCH3 = path.dirname(STORE);
const REPO_PREFIX = 'match3/';
const RAW_STORE = 'https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/';
const RAW_RELEASE = 'https://github.com/ahmadkataf/lovable.dev/raw/ccr-bcb81736-74rbji/match3/release/';
const CHECK_ONLY = process.argv.includes('--check');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const fields = readJson(path.join(STORE, 'listing', 'fields.json'));
const owner = readJson(path.join(STORE, 'owner.json'));
const shots = readJson(path.join(STORE, 'screenshots', 'manifest.json'));
const gradle = fs.readFileSync(path.join(MATCH3, 'android', 'gradle.properties'), 'utf8');
const prop = (k) => (new RegExp('^' + k + '=(.*)$', 'm').exec(gradle) || [])[1].trim();
const versionCode = Number(prop('VERSION_CODE'));
const versionName = prop('VERSION_NAME');

const storeAsset = (rel, extra) => Object.assign({ repoPath: REPO_PREFIX + 'store/' + rel, url: RAW_STORE + rel }, extra || {});
const SHOT_NAMES = ['01-match-gems', '02-special-pieces', '03-six-worlds', '04-goals', '05-boosters', '06-rewards', '07-offline', '08-languages'];
const DEVICES = {
  phone: { size: '1080×1920', w: 1080, h: 1920, consoleField: 'Phone screenshots' },
  tablet7: { size: '1200×1920', w: 1200, h: 1920, consoleField: '7-inch tablet screenshots' },
  tablet10: { size: '1600×2560', w: 1600, h: 2560, consoleField: '10-inch tablet screenshots' },
};
const LOCALES = { 'en-US': 'en', ar: 'ar' };

function screenshotList(device, lang) {
  return SHOT_NAMES.map((name, i) => {
    const rel = 'screenshots/' + device + '/' + lang + '/' + name + '.png';
    const m = shots.finals[device + '/' + lang + '/' + name + '.png'] || {};
    return storeAsset(rel, { order: i + 1, pixels: DEVICES[device].size, caption: (m.caption || []).join(' '), altText: m.alt || null });
  });
}

// ─────────────────────────── products (docs/DESIGN.md §7) ───────────────────────────
const PRODUCTS = [
  { id: 'coins_small', kind: 'consumable', grants: '1,000 coins', priceUsd: '0.99',
    en: { name: '1,000 Coins', description: 'A pack of 1,000 coins.' }, ar: { name: '1000 عملة', description: 'حزمة من 1000 عملة.' } },
  { id: 'coins_medium', kind: 'consumable', grants: '5,500 coins', priceUsd: '4.99',
    en: { name: '5,500 Coins', description: 'A pack of 5,500 coins.' }, ar: { name: '5500 عملة', description: 'حزمة من 5500 عملة.' } },
  { id: 'coins_large', kind: 'consumable', grants: '12,000 coins (badge in game: popular)', priceUsd: '9.99',
    en: { name: '12,000 Coins', description: 'A pack of 12,000 coins.' }, ar: { name: '12000 عملة', description: 'حزمة من 12000 عملة.' } },
  { id: 'coins_xl', kind: 'consumable', grants: '26,000 coins', priceUsd: '19.99',
    en: { name: '26,000 Coins', description: 'A pack of 26,000 coins.' }, ar: { name: '26000 عملة', description: 'حزمة من 26000 عملة.' } },
  { id: 'coins_mega', kind: 'consumable', grants: '70,000 coins (badge in game: best)', priceUsd: '49.99',
    en: { name: '70,000 Coins', description: 'A pack of 70,000 coins.' }, ar: { name: '70000 عملة', description: 'حزمة من 70000 عملة.' } },
  { id: 'starter_pack', kind: 'non-consumable (entitlement, bought once)', grants: '4,000 coins + 3 Hammer + 3 Free Swap + 2 Prism, and removes interstitial ads', priceUsd: '1.99',
    en: { name: 'Starter Pack', description: '4,000 coins, 3 Hammers, 3 Free Swaps and 2 Prisms. Removes ads between levels. One purchase per player.' },
    ar: { name: 'حزمة البداية', description: '4000 عملة و3 مطارق و3 تبديل حر و2 منشور، مع إزالة الإعلانات بين المراحل. تُشترى مرة واحدة.' } },
  { id: 'remove_ads', kind: 'non-consumable (entitlement)', grants: 'removes interstitial ads; optional rewarded ads stay available', priceUsd: '2.99',
    en: { name: 'Remove Ads', description: 'Removes the ads shown between levels. Optional reward videos stay available.' },
    ar: { name: 'إزالة الإعلانات', description: 'يزيل الإعلانات التي تظهر بين المراحل. إعلانات المكافأة الاختيارية تبقى متاحة.' } },
];

// ─────────────────────────── Data safety (ads flavour) ───────────────────────────
const PURPOSES = ['Advertising or marketing', 'Analytics', 'Fraud prevention, security, and compliance'];
const DATA_TYPES = [
  { category: 'Location', type: 'Approximate location', why: 'IP address, collected by the Google Mobile Ads SDK' },
  { category: 'App activity', type: 'App interactions', why: 'user product interactions, collected by the ads SDK' },
  { category: 'App info and performance', type: 'Diagnostics', why: 'diagnostic information, collected by the ads SDK' },
  { category: 'Device or other IDs', type: 'Device or other IDs', why: 'advertising ID and app set ID, collected by the ads SDK' },
].map((d) => Object.assign(d, { collected: true, shared: true, processedEphemerally: false, requiredOrOptional: 'Required (users cannot turn this collection off in the app)', collectionPurposes: PURPOSES, sharingPurposes: PURPOSES }));

const len = (s) => [...s].length;

function build() {
  const listing = {};
  for (const [loc, lang] of Object.entries(LOCALES)) {
    const f = fields[loc];
    listing[loc] = {
      appName: f.title,
      shortDescription: f.shortDescription,
      fullDescription: f.fullDescription,
      characterCounts: { appName: len(f.title), shortDescription: len(f.shortDescription), fullDescription: len(f.fullDescription) },
      appIcon: loc === 'en-US' ? storeAsset('graphics/icon-512.png', { pixels: '512×512' }) : 'inherited from en-US (same icon for every language; do not upload a different one)',
      featureGraphic: storeAsset(lang === 'en' ? 'graphics/feature-graphic.png' : 'graphics/feature-graphic-ar.png', { pixels: '1024×500' }),
      phoneScreenshots: screenshotList('phone', lang),
      tablet7Screenshots: screenshotList('tablet7', lang),
      tablet10Screenshots: screenshotList('tablet10', lang),
    };
  }
  return {
    _readme: [
      'Machine-readable Google Play Console values for Zumurud (com.zumurud.game). Generated by: node store/build-play-console.cjs. Do not edit by hand.',
      'The step-by-step order and the STOP rules are in store/UPLOAD-RUNBOOK.md; this file holds the same values. If the two ever disagree, stop and ask the owner.',
      'Listing texts are copied verbatim from store/listing/fields.json (authoritative). "\\n" inside a string is a line break. Paste strings exactly; never rephrase or translate.',
      'Every asset has repoPath (path inside the GitHub repository) and url (direct download). If a url does not download, ask the owner to upload the file from the local copy of repoPath.',
      'Values that are null with humanFills=true must be entered by the owner. The assistant must stop and ask; it must never guess them.',
    ],
    app: {
      appName: fields['en-US'].title,
      packageName: owner.applicationId,
      defaultLanguage: 'en-US (English (United States))',
      additionalLanguages: ['ar (Arabic)'],
      appOrGame: 'Game',
      freeOrPaid: 'Free',
      developerName: owner.developerName,
      versionCode,
      versionName,
    },
    urls: {
      privacyPolicy: owner.privacyPolicyUrl,
      website: owner.developerWebsite,
      appAdsTxt: owner.appAdsTxtUrl,
      rawStoreBase: RAW_STORE,
      rawReleaseBase: RAW_RELEASE,
    },
    release: {
      flavour: 'ads',
      containsAds: true,
      containsInAppPurchases: true,
      appBundle: { repoPath: REPO_PREFIX + 'release/Zumurud-' + versionName + '-ads.aab', url: RAW_RELEASE + 'Zumurud-' + versionName + '-ads.aab', versionCode, versionName },
      doNotUpload: ['any .apk file', 'any file with DEBUG or preview in its name', 'the plain flavour .aab'],
      firstTrack: 'Internal testing',
      thenTrack: 'Production (the account is exempt from the 12-tester / 14-day closed test)',
      appSigning: 'Play App Signing with a key generated and kept by Google (the default for new apps). Never upload or export a signing key.',
      releaseNotesBox: fields.releaseNotesBox,
      releaseNotes: { 'en-US': fields['en-US'].releaseNotes, ar: fields.ar.releaseNotes },
      internalTesters: { emailListName: 'Zumurud owner', emails: null, humanFills: true, note: "The owner's Google account e-mail (ask the owner)." },
    },
    storeListing: listing,
    storeSettings: {
      appOrGame: fields._meta.category.applicationType,
      category: fields._meta.category.category,
      tags: { maximum: fields._meta.tags.maximum, rule: 'Pick, in this order, the first five that the tag picker offers; never pick a tag not on this list.', inOrderOfPriority: fields._meta.tags.inOrderOfPriority.map((t) => ({ label: t.label, labelInArabicConsole: t.labelInArabicConsole })) },
      contactDetails: {
        email: { value: null, humanFills: true, note: "The e-mail address of the Play Console account. The owner types it (or tells the assistant). Required." },
        phone: { value: null, humanFills: true, note: 'Optional. Leave empty unless the owner gives a number.' },
        website: { value: owner.developerWebsite, note: 'Required for AdMob: it serves /app-ads.txt.' },
      },
      externalMarketing: 'Leave at the default.',
    },
    appContent: {
      privacyPolicy: { url: owner.privacyPolicyUrl },
      ads: { containsAds: 'Yes', note: 'The uploaded bundle is the ads flavour (Google Mobile Ads SDK: rewarded + interstitial). In-app purchase offers are not ads.' },
      appAccess: { answer: 'All functionality is available without special access', consoleLabelVerified: false, note: 'No account, no login, no code. Pick the option with this meaning; enter no credentials.' },
      contentRating: {
        email: { value: null, humanFills: true, note: 'The questionnaire asks for a contact e-mail: use the Play Console account e-mail (ask the owner).' },
        category: 'Game',
        questionWordingVerified: false,
        answers: [
          { topic: 'Violence (any kind, including cartoon or fantasy), blood, gore', answer: 'No', why: 'Abstract jewel puzzle, no characters' },
          { topic: 'Fear, horror, frightening content', answer: 'No' },
          { topic: 'Sexual content, nudity, suggestive themes', answer: 'No' },
          { topic: 'Profanity, crude humour, offensive language', answer: 'No' },
          { topic: 'Drugs, alcohol, tobacco (use or reference)', answer: 'No' },
          { topic: 'Discrimination, hate', answer: 'No' },
          { topic: 'Real-money gambling', answer: 'No' },
          { topic: 'Simulated gambling (cards, dice, slots, betting, wheels of chance)', answer: 'No', why: 'The daily gift is a fixed 7-day cycle, not chance' },
          { topic: 'Users can interact or communicate with each other (chat, messages, voice)', answer: 'No', why: 'Single player, no accounts' },
          { topic: 'Users can share content they create', answer: 'No' },
          { topic: "Shares the user's current location with other users", answer: 'No' },
          { topic: 'Purchase of digital goods in the app', answer: 'Yes', why: 'Coin packs, starter pack, remove ads' },
          { topic: 'Randomised paid items (loot boxes, gacha)', answer: 'No', why: 'Every pack has fixed, stated contents' },
          { topic: 'Unrestricted internet access / web browser', answer: 'No', why: 'The game shows only its own bundled pages; no browsing' },
          { topic: 'Contains ads (if asked)', answer: 'Yes' },
          { topic: 'Any other question', answer: 'No, unless it plainly describes the facts above; if unsure, stop and ask the owner' },
        ],
        expectedResult: 'An age rating per region chosen by the rating bodies, plus the "In-Game Purchases" interactive element. No specific rating is promised.',
      },
      targetAudience: {
        ageGroups: ['13-15', '16-17', '18 and over'],
        doNotSelect: ['5 and under', '6-8', '9-12'],
        unintendedAppealToChildren: 'No',
        note: 'If the form warns that 13-15 / 16-17 may count as children in some places, read it, keep the selection, and tell the owner.',
      },
      dataSafety: {
        collectsOrSharesRequiredDataTypes: 'Yes',
        encryptedInTransit: 'Yes',
        accountCreation: 'The app does not allow users to create an account',
        dataDeletionRequest: 'No (the developer holds no user data; privacy policy section 6). If the form makes a deletion URL mandatory, stop and ask the owner.',
        independentSecurityReview: 'No / leave unselected',
        dataTypes: DATA_TYPES,
        doNotDeclare: ['Personal info', 'Financial info (Google Play collects payment data directly; purchase confirmations stay on the device)', 'Purchase history', 'Precise location', 'Messages', 'Photos and videos', 'Audio', 'Files and docs', 'Calendar', 'Contacts', 'Web browsing', 'Health and fitness', 'Crash logs'],
        source: 'docs/research/ads.md (Google Mobile Ads SDK data disclosure); store/PUBLISHING-GUIDE.ar.md §6.6 table B',
        consoleLabelsVerified: 'Data type and purpose names follow the Play data-type list; the mapping of "IP address" to Approximate location is the closest field, as in the guide.',
      },
      advertisingId: { usesAdvertisingId: 'Yes', purposes: PURPOSES, consoleLabelVerified: false, note: 'The ads SDK merges the AD_ID permission into the app automatically.' },
      governmentApps: 'No',
      financialFeatures: 'The app does not provide any financial features',
      healthApps: 'The app does not have any health features',
      newsApps: 'No',
      otherDeclarations: 'If any other declaration appears (sensitive permissions, foreground services, photo/video access, etc.): the app requests none of these; answer accordingly or stop and ask.',
    },
    products: {
      where: 'Monetize with Play > Products > One-time products (available only after a bundle with the billing library is on a track and the payments profile exists)',
      rules: [
        'Product IDs exactly as written: they can never be changed or reused.',
        'One purchase option of type Buy per product.',
        'Price: enter the US$ price and let Play Console convert it for the other regions; keep every region available.',
        'Do not enable multi-quantity.',
        'Add the English and Arabic name and description, then Activate.',
      ],
      list: PRODUCTS.map((p) => ({
        productId: p.id, kind: p.kind, grants: p.grants, suggestedBasePriceUsd: p.priceUsd,
        'en-US': Object.assign({}, p.en, { nameCharacters: len(p.en.name), descriptionCharacters: len(p.en.description) }),
        ar: Object.assign({}, p.ar, { nameCharacters: len(p.ar.name), descriptionCharacters: len(p.ar.description) }),
      })),
      priceSource: 'docs/DESIGN.md §7 (suggested; the owner may change prices at any time without an app update)',
    },
    countries: {
      decidedBy: 'owner',
      questionsToAsk: [
        'Publish in all available countries, or a chosen list?',
        'Japan: sales there need the payments-collection authorisation (announced deadline 1 December 2026); otherwise payouts are held worldwide. Complete it, or exclude Japan for now?',
        'EEA and UK: selling there makes the account a "trader" (public address and phone for a personal account). Include them, or leave them out for now?',
      ],
    },
    humanOnly: [
      'Accepting legal terms and policy confirmations (Developer Program Policies, export laws, Play App Signing terms, service-fee terms).',
      'Identity verification of the developer or merchant, if Google asks.',
      'Payments profile (merchant), legal name and address, bank account in Kuwait, bank verification.',
      'US tax form (W-8BEN) in the payments profile.',
      'Trader status declaration (Manage account > Account details), and a terms-of-service URL if declared a trader.',
      'Enrolling in the 15% service-fee tier (Associated developer accounts / account group).',
      'Contact e-mail, phone number, tester e-mails, content-rating e-mail.',
      'Choice of countries (Japan, EEA/UK) and final prices.',
      'Installing the internal test on a phone and test purchases with a license tester.',
      'The final "send for review" / "start roll-out to production" click needs the owner\'s explicit go-ahead.',
      'AdMob: linking the app to its Play listing after publication, and any AdMob payment, tax or PIN step.',
    ],
  };
}

// ─────────────────────────── runbook tables ───────────────────────────
function mdLink(a) { return '`' + a.repoPath + '` — <' + a.url + '>'; }

function assetsTables(pc) {
  const out = [];
  out.push('#### Icon (en-US listing only; Arabic inherits it)', '', '| Field | File | Pixels |', '|---|---|---|', '| App icon | ' + mdLink(pc.storeListing['en-US'].appIcon) + ' | 512×512 |', '');
  for (const loc of Object.keys(LOCALES)) {
    const L = pc.storeListing[loc];
    out.push('#### ' + loc + ' — feature graphic', '', '| Field | File | Pixels |', '|---|---|---|', '| Feature graphic | ' + mdLink(L.featureGraphic) + ' | 1024×500 |', '');
    for (const [key, dev] of [['phoneScreenshots', 'phone'], ['tablet7Screenshots', 'tablet7'], ['tablet10Screenshots', 'tablet10']]) {
      out.push('#### ' + loc + ' — ' + DEVICES[dev].consoleField + ' (' + DEVICES[dev].size + ', upload in this order)', '', '| # | File | Alt text (only if the console offers a description field) |', '|---|---|---|');
      for (const s of L[key]) out.push('| ' + s.order + ' | ' + mdLink(s) + ' | ' + (s.altText || '') + ' |');
      out.push('');
    }
  }
  return out.join('\n');
}

function dataSafetyTable(pc) {
  const out = ['| Data category | Data type | Collected | Shared | Processed ephemerally | Required or optional | Purposes (for collection AND for sharing) | Why |', '|---|---|---|---|---|---|---|---|'];
  for (const d of pc.appContent.dataSafety.dataTypes) out.push('| ' + d.category + ' | ' + d.type + ' | Yes | Yes | No | Required | ' + d.collectionPurposes.join('; ') + ' | ' + d.why + ' |');
  return out.join('\n');
}

function productsTable(pc) {
  const out = ['| # | Product ID | Kind | Suggested price (US$) | Name (en-US) | Description (en-US) | Name (ar) | Description (ar) |', '|---|---|---|---|---|---|---|---|'];
  pc.products.list.forEach((p, i) => out.push('| ' + (i + 1) + ' | `' + p.productId + '` | ' + p.kind + ' | ' + p.suggestedBasePriceUsd + ' | ' + p['en-US'].name + ' | ' + p['en-US'].description + ' | ' + p.ar.name + ' | ' + p.ar.description + ' |'));
  return out.join('\n');
}

function fillRunbook(text, pc) {
  const blocks = { 'full-en': '```text\n' + pc.storeListing['en-US'].fullDescription + '\n```', 'full-ar': '```text\n' + pc.storeListing.ar.fullDescription + '\n```', 'release-notes': '```text\n' + pc.release.releaseNotesBox + '\n```', assets: assetsTables(pc),'data-safety': dataSafetyTable(pc), products: productsTable(pc) };
  for (const [name, body] of Object.entries(blocks)) {
    const re = new RegExp('(<!-- generated:' + name + ':begin[^>]*-->)[\\s\\S]*?(<!-- generated:' + name + ':end -->)');
    if (!re.test(text)) throw new Error('UPLOAD-RUNBOOK.md has no generated:' + name + ' markers');
    text = text.replace(re, (_, a, b) => a + '\n' + body + '\n' + b);
  }
  return text;
}

// ─────────────────────────── checks ───────────────────────────
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function check(pc, runbookPath, expectedRunbook) {
  const problems = [];
  const pending = [];
  let assets = 0;
  const seen = (a, w, h) => {
    const file = path.join(MATCH3, a.repoPath.slice(REPO_PREFIX.length));
    if (!a.url.endsWith(a.repoPath.slice((REPO_PREFIX + 'store/').length))) problems.push('url does not match repoPath: ' + a.url);
    if (!fs.existsSync(file)) return problems.push('missing on disk: ' + a.repoPath);
    assets++;
    if (w) { const s = pngSize(file); if (s.w !== w || s.h !== h) problems.push(a.repoPath + ' is ' + s.w + '×' + s.h + ', expected ' + w + '×' + h); }
  };
  seen(pc.storeListing['en-US'].appIcon, 512, 512);
  for (const loc of Object.keys(LOCALES)) {
    const L = pc.storeListing[loc];
    seen(L.featureGraphic, 1024, 500);
    for (const [key, dev] of [['phoneScreenshots', 'phone'], ['tablet7Screenshots', 'tablet7'], ['tablet10Screenshots', 'tablet10']]) {
      if (L[key].length !== 8) problems.push(loc + ' ' + key + ': ' + L[key].length + ' files, expected 8');
      for (const s of L[key]) { seen(s, DEVICES[dev].w, DEVICES[dev].h); if (!s.altText) problems.push('no alt text for ' + s.repoPath); else if (len(s.altText) > 140) problems.push('alt text over 140 characters: ' + s.repoPath); }
    }
    for (const k of ['title', 'shortDescription', 'fullDescription']) {
      const mine = L[k === 'title' ? 'appName' : k];
      if (mine !== fields[loc][k]) problems.push(loc + '.' + k + ' differs from listing/fields.json');
    }
    if (len(L.appName) > 30 || len(L.shortDescription) > 80 || len(L.fullDescription) > 4000) problems.push(loc + ': a listing text is over its limit');
  }
  for (const p of pc.products.list) {
    if (!/^[a-z0-9][a-z0-9_.]*$/.test(p.productId)) problems.push('bad product id ' + p.productId);
    for (const loc of ['en-US', 'ar']) { if (p[loc].nameCharacters > 55) problems.push(p.productId + ' ' + loc + ' name over 55'); if (p[loc].descriptionCharacters > 200) problems.push(p.productId + ' ' + loc + ' description over 200'); }
  }
  if (pc.products.list.length !== 7) problems.push('expected 7 products');
  const aab = path.join(MATCH3, pc.release.appBundle.repoPath.slice(REPO_PREFIX.length));
  if (!fs.existsSync(aab)) pending.push(pc.release.appBundle.repoPath + ' is not built yet (release engineer)');
  // the JSON on disk must be what this script generates, and must parse
  const jsonPath = path.join(STORE, 'play-console.json');
  try {
    const onDisk = fs.readFileSync(jsonPath, 'utf8');
    JSON.parse(onDisk);
    if (onDisk !== JSON.stringify(pc, null, 2) + '\n') problems.push('play-console.json is stale (run node store/build-play-console.cjs)');
  } catch (e) { problems.push('play-console.json: ' + e.message); }
  if (fs.readFileSync(runbookPath, 'utf8') !== expectedRunbook) problems.push('UPLOAD-RUNBOOK.md generated tables are stale (run node store/build-play-console.cjs)');
  // texts typed out by hand in the runbook must be the authoritative ones
  const verbatim = [fields.releaseNotesBox, fields['en-US'].title, fields.ar.title, fields['en-US'].shortDescription, fields.ar.shortDescription,
    String(len(fields['en-US'].fullDescription)) + ' characters', String(len(fields.ar.fullDescription)) + ' characters', owner.privacyPolicyUrl, owner.developerName];
  for (const v of verbatim) if (expectedRunbook.indexOf(v) < 0) problems.push('UPLOAD-RUNBOOK.md does not contain, verbatim: ' + v.slice(0, 60));
  // every repo path mentioned in the runbook text exists
  const mentioned = new Set((expectedRunbook.match(/match3\/store\/[A-Za-z0-9_./-]+\.(?:png|md|json|html|txt)/g) || []));
  for (const m of mentioned) if (!fs.existsSync(path.join(MATCH3, m.slice(REPO_PREFIX.length)))) problems.push('runbook mentions a missing file: ' + m);
  return { problems, pending, assets, mentioned: mentioned.size };
}

const pc = build();
const runbookPath = path.join(STORE, 'UPLOAD-RUNBOOK.md');
const expectedRunbook = fillRunbook(fs.readFileSync(runbookPath, 'utf8'), pc);
if (!CHECK_ONLY) {
  fs.writeFileSync(path.join(STORE, 'play-console.json'), JSON.stringify(pc, null, 2) + '\n');
  fs.writeFileSync(runbookPath, expectedRunbook);
}
const r = check(pc, runbookPath, expectedRunbook);
console.log('play-console.json: parses; ' + r.assets + ' store assets exist with the right pixel size; listing texts identical to fields.json; ' + pc.products.list.length + ' products');
console.log('UPLOAD-RUNBOOK.md: generated tables up to date; ' + r.mentioned + ' store paths mentioned, all present');
for (const p of r.pending) console.log('  pending  ' + p);
for (const p of r.problems) console.log('  FAIL     ' + p);
if (r.problems.length) { console.log(r.problems.length + ' problem(s)'); process.exit(1); }
console.log('ok');
