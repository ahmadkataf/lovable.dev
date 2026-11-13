# Upload runbook — Zumurud on Google Play (for an AI browser assistant)

You are operating Google Play Console in the owner's browser, signed in to the owner's developer account.
Follow the steps in order. Type every value exactly as given here. The same values are in
`match3/store/play-console.json` (machine-readable); if this file and that one ever disagree, **stop and ask the owner**.

## Rules — read before step 1

1. **STOP and ask the owner** at every step marked **STOP (owner)**, and whenever a page asks for anything
   not given in this file: personal data, identity documents, an address, a phone number, bank or tax
   details, an e-mail address, a legal confirmation or a policy checkbox. Never guess, never invent,
   never tick a legal checkbox on the owner's behalf. Show the owner the page and wait.
2. Paste texts **exactly**. Do not rephrase, shorten, translate, "correct", add emoji or change capitals.
   Arabic text may look as if its punctuation is misplaced inside a left-to-right box; that is only how
   the box draws it — do not reorder anything.
3. Never mention, compare with or name any other game or brand anywhere.
4. Menu names can change. Where this file says "the page for …", find it by purpose (the search box at
   the top of Play Console helps). Labels written in quotes and marked *(unverified label)* were not
   confirmed on a Google page: pick the option with that meaning.
5. Files: each file has a **repo path** (inside the GitHub repository `ahmadkataf/lovable.dev`, branch
   `ccr-bcb81736-74rbji`) and a **download URL**. Download the file from the URL, then upload it in the
   console. If a URL does not download (404), **STOP (owner)**: ask the owner to upload the file from
   their local copy of the repo path.
6. If Play Console shows an error, a policy warning or a blocking issue you cannot solve with this file,
   stop, copy the message word for word, and show it to the owner.

## Fixed facts

| Item | Value |
|---|---|
| App name (en-US) | `Zumurud: Gem Match 3 Puzzle` |
| App name (ar) | `زمرد: لعبة ألغاز الجواهر` |
| Package name | `com.zumurud.game` |
| Public developer name | `Fekra Ads` (already set on the account; do not change it) |
| Default language | English (United States) – en-US; added translation: Arabic – ar |
| App or game / Free or paid | Game / Free |
| Category | Puzzle |
| Privacy policy URL | `https://zumurud-privacy.almutafawiqin.workers.dev/` |
| Developer website | `https://zumurud-privacy.almutafawiqin.workers.dev/` (it also serves `/app-ads.txt` for AdMob) |
| Support e-mail | the e-mail of this Play Console account — **STOP (owner)**: the owner types it or tells you |
| Build to upload | `match3/release/Zumurud-1.0.0-ads.aab` — <https://github.com/ahmadkataf/lovable.dev/raw/ccr-bcb81736-74rbji/match3/release/Zumurud-1.0.0-ads.aab> (versionCode 1, versionName 1.0.0) |
| What the build contains | the **ads** flavour: AdMob rewarded + interstitial ads, consent dialog (UMP), and Google Play in-app purchases |
| Testing requirement | the account is exempt from the 12-tester / 14-day closed test; internal testing first, then production |

Never upload an `.apk`, a file with `DEBUG` or `preview` in its name, or a `-plain` bundle.

---

## 0. Prerequisites (check, do not do)

0.1. The owner is signed in to Play Console with the developer account that publishes as **Fekra Ads**.
0.2. The privacy policy URL opens in a normal browser tab without login. Open it once to confirm.
0.3. `https://zumurud-privacy.almutafawiqin.workers.dev/app-ads.txt` opens and shows one line starting with `google.com, pub-2987896644184673`.
0.4. The bundle URL in "Fixed facts" downloads a file ending in `.aab`. If it does not, **STOP (owner)**: the release file is not ready.
0.5. Ask the owner once, before starting: **STOP (owner)** — "Is a payments profile (merchant account) already linked to this developer account?" If not, in-app products cannot be created (step 9); everything else can continue, and the owner sets it up (step 10).

## 1. Create the app

1.1. Play Console home → **Create app**.
1.2. App name: `Zumurud: Gem Match 3 Puzzle`
1.3. Default language: **English (United States) – en-US**
1.4. App or game: **Game**
1.5. Free or paid: **Free**
1.6. Declarations (Developer Program Policies, US export laws, and any other checkbox): **STOP (owner)** — the owner reads and ticks them personally.
1.7. Click **Create app**.
1.8. If Play Console says the package name `com.zumurud.game` belongs to another developer (this can appear at the first upload): **STOP (owner)** and upload nothing.

## 2. Upload the bundle to Internal testing

2.1. Left menu → Test and release → Testing → **Internal testing** → **Create new release**.
2.2. App integrity / app signing: if asked how the app is signed, keep the default **Google-generated app signing key (Play App Signing)**. Do not upload, export or choose your own signing key. If terms must be accepted for Play App Signing: **STOP (owner)**.
2.3. Upload `Zumurud-1.0.0-ads.aab` (download URL in "Fixed facts"). Wait until it shows version code **1** and version name **1.0.0**. If the upload is rejected (wrong signature, version code already used, package name taken): **STOP (owner)** with the exact message.
2.4. Release name: keep the default (`1 (1.0.0)`).
2.5. Release notes: paste this block exactly (it is `releaseNotesBox` in `match3/store/listing/fields.json`). If the box already shows language tags, keep the tags it shows and paste only the text between them.

<!-- generated:release-notes:begin (written by node store/build-play-console.cjs; do not edit inside) -->
```text
<en-US>
Welcome to Zumurud, a match 3 puzzle game with jewels, set in a desert oasis.
• 120 levels in six worlds, from the Oasis to the Starlit Sky
• Three special pieces (Beam, Nova and Prism) and six combos
• Sand, stones, chains and vines to clear, and lamps to bring down
• Six boosters, the Caravan win streak and a daily gift
• Plays offline, in English and Arabic
</en-US>
<ar>
أهلًا بك في زمرد، لعبة ألغاز الجواهر في واحة الصحراء.
• 120 مرحلة في ستة عوالم، من الواحة إلى سماء النجوم
• ثلاث قطع خاصة (الشعاع والنوفا والمنشور) وست تركيبات بينها
• رمال وأحجار وسلاسل ونباتات متسلقة تزيلها، وفوانيس تنزلها إلى أسفل اللوحة
• ستة معززات، والقافلة التي تكافئ الانتصارات المتتالية، وهدية اليوم
• تُلعب بدون نت، بالعربية والإنجليزية
</ar>
```
<!-- generated:release-notes:end -->

2.6. Save → Next/Review → **Save and publish** (or "Start roll-out to Internal testing"). Internal testing needs no review.
2.7. Testers tab: create an e-mail list named `Zumurud owner`. E-mail addresses: **STOP (owner)** — ask which Google account(s) to add. Save, tick the list, and copy the **opt-in link** ("Join on the web" / "Copy link"). Give the link to the owner.
2.8. Pre-review / pre-launch checks start automatically. If any check is marked critical, **STOP (owner)** with the message.

## 3. Store settings — category, tags, contact details

The page for the app's category and contact details (Grow users → Store presence → **Store settings**).

3.1. App or game: **Game**. Category: **Puzzle**.
3.2. Tags → **Manage tags**: choose at most five, in this order, taking the first five that the picker offers; never choose a tag that is not on this list: `Match 3`, `Puzzle`, `Gems & jewels`, `Casual`, `Offline`; spare: `Single player`. (Arabic console labels: مطابقة 3، ألغاز، أحجار كريمة وجواهر، الألعاب البسيطة، بلا اتصال بالإنترنت، اللعب الفردي.)
3.3. Store listing contact details:
   - Email address: **STOP (owner)** — the e-mail of this Play Console account; the owner types it or dictates it.
   - Phone number: leave empty unless the owner gives one.
   - Website: `https://zumurud-privacy.almutafawiqin.workers.dev/`
3.4. External marketing: leave the default. Save.

## 4. Main store listing — en-US (default language)

The page for the default store listing (Grow users → Store presence → Store listings → the default listing).

4.1. App name: `Zumurud: Gem Match 3 Puzzle` (27 characters)
4.2. Short description (73 characters):

```text
Match 3 jewels across a desert oasis: 120 puzzle levels, playable offline
```

4.3. Full description: paste `storeListing["en-US"].fullDescription` from `match3/store/play-console.json` (identical to `"en-US".fullDescription` in `match3/store/listing/fields.json`), 3184 characters, line breaks included. It begins "Zumurud is an offline match 3 puzzle game" and ends "see how far the caravan takes you." After pasting, the console counter must show about 3184 (a few more is fine if line breaks count double; fewer means it was cut — paste again).

<!-- generated:full-en:begin (written by node store/build-play-console.cjs; do not edit inside) -->
```text
Zumurud is an offline match 3 puzzle game set among the jewels of a moonlit desert oasis. Swap gems to match three or more, combine special pieces into board-clearing combos, and journey through 120 levels in six worlds, from the Oasis to the Starlit Sky. No Wi-Fi is needed to play, and there is no account to create.

How to play
• The classic match 3 rule: swap two adjacent gems to get three or more of the same kind in a row.
• Complete each level's goal before your moves run out. Levels are limited by moves, not by a timer, so you can think at your own pace.
• Earn up to three stars per level, and replay any level to improve your score.

Special pieces and combos
• Beam: match four gems in a line. It clears a whole row or column.
• Nova: match gems in an L or T shape. It bursts and clears everything around it.
• Prism: match five gems in a line. Swap it with any gem to clear every gem of that color.
• Swap two special pieces with each other for a bigger effect. There are six combos to discover.

Six worlds, 120 levels
Oasis, Dunes, Bazaar, Palace, Caverns and Starlit Sky: each world is a chapter of twenty levels with its own backdrop. Goals change as you go: reach a score, collect gems of one color, clear the sand, break stones and chains, cut back vines before they spread, or bring brass lamps down to the bottom of the board.

Jewels you can tell apart at a glance
Ruby, amber, emerald, sapphire, amethyst and moonstone: each jewel has its own color and its own cut, so the board stays readable on small screens and for players who find some colors hard to tell apart.

Boosters and rewards
• Six boosters, each introduced with a gift so you can try it: a hammer, a swap that needs no match, a shuffle, extra moves, and head starts with special pieces already on the board.
• The Caravan: win levels in a row and your next level starts with special pieces waiting on the board.
• A daily gift on a seven-day cycle.
• Five lives: failing a level costs one, one returns every 30 minutes, and winning never costs a life.

Play anywhere
• A match 3 game that works offline: the puzzle levels need no Wi-Fi and no mobile data, so you can play in airplane mode, on a flight or on your commute.
• Single player. Your progress is saved on your device.
• English and Arabic, with a full right-to-left layout in Arabic. Switch language at any time in Settings.
• Artwork and sound made for this game, with a calm, relaxing soundtrack led by an oud-style melody.
• Made for teens and adults aged 13 and over who enjoy jewel games and matching puzzles.

Purchases and ads, stated plainly
All 120 levels can be finished without buying anything. The game contains optional in-app purchases: packs of coins, a one-time starter pack, and an option that removes the ads shown between levels. Coins are also earned by playing. The game contains ads. Rewarded video ads play only when you choose to watch one. Ads between levels are occasional, never interrupt a level, and stop after any purchase. Playing needs no connection; only purchases and ads do.

Zumurud is the Arabic word for emerald. The oasis is waiting: make your first match and see how far the caravan takes you.
```
<!-- generated:full-en:end -->
4.4. Graphics — upload the files from section 4.7 below:
   - App icon (512×512)
   - Feature graphic (1024×500), English file
   - Phone screenshots: the 8 English phone files, in order 1 → 8
   - 7-inch tablet screenshots: the 8 English 7-inch files, in order
   - 10-inch tablet screenshots: the 8 English 10-inch files, in order
   - Video (YouTube URL): leave empty. Chromebook / TV / Wear / car screenshots: leave empty.
4.5. Save.

### 4.6. Add the Arabic translation (ar)

1. On the same listing page: **Manage translations** → Add / select languages → **Arabic – ar** → Apply → Save.
2. Switch the language selector to **Arabic – ar** and fill:
   - App name: `زمرد: لعبة ألغاز الجواهر` (24 characters)
   - Short description (71 characters):

```text
لعبة مجوهرات بدون نت: طابق جواهر الواحة واعبر 120 مرحلة حتى سماء النجوم
```

   - Full description: paste `storeListing.ar.fullDescription` from `match3/store/play-console.json` (identical to `ar.fullDescription` in `fields.json`), 2948 characters. It begins "زمرد لعبة جواهر بدون نت". Text:

<!-- generated:full-ar:begin (written by node store/build-play-console.cjs; do not edit inside) -->
```text
زمرد لعبة جواهر بدون نت، تجمع بين ألغاز مطابقة 3 وأجواء واحة صحراوية تحت ضوء القمر. بدّل الجواهر، وطابق ثلاثًا منها أو أكثر، واصنع قطعًا خاصة تمسح اللوحة، في رحلة من 120 مرحلة عبر ستة عوالم، أولها الواحة وآخرها سماء النجوم. لعبة مجوهرات بواجهة عربية كاملة، لا تحتاج إلى واي فاي ولا إلى حساب.

طريقة اللعب
• القاعدة بسيطة: بدّل مكان جوهرتين متجاورتين لتصطف ثلاث جواهر متماثلة أو أكثر في صف أو عمود.
• حقّق هدف المرحلة قبل أن تنتهي حركاتك. المراحل محدودة بعدد الحركات لا بالوقت، فالعب على مهلك.
• اجمع حتى ثلاث نجوم في كل مرحلة، وأعد أي مرحلة متى شئت لتحسّن نتيجتك.

قطع خاصة وتركيبات
• الشعاع: تصنعه بمطابقة أربع جواهر في خط واحد، فيمسح صفًّا أو عمودًا كاملًا.
• النوفا: تصنعها بمطابقة الجواهر على شكل L أو T، فتفجّر كل ما حولها.
• المنشور: تصنعه بمطابقة خمس جواهر في خط واحد، ثم تبدّله مع أي جوهرة ليزيل كل الجواهر من لونها.
• بدّل قطعتين خاصتين إحداهما مع الأخرى لتحصل على تأثير أكبر. ست تركيبات تنتظر أن تكتشفها.

ستة عوالم و120 مرحلة
الواحة، الكثبان، السوق، القصر، الكهوف، سماء النجوم: كل عالم فصل من عشرين مرحلة له خلفيته الخاصة. مراحل تتدرج في مستويات الصعوبة وتتغير أهدافها: بلوغ عدد من النقاط، أو جمع جواهر من لون معين، أو إزالة الرمال، أو تحطيم الأحجار، أو كسر السلاسل، أو قطع النبات المتسلق قبل أن ينتشر، أو إنزال الفوانيس النحاسية إلى أسفل اللوحة.

جواهر تميزها من النظرة الأولى
ستة أنواع من الأحجار الكريمة: الياقوت الأحمر والكهرمان والزمرد والياقوت الأزرق والجمشت وحجر القمر. لكل جوهرة لونها وشكلها الخاص، فتبقى اللوحة واضحة على الشاشات الصغيرة ولمن يصعب عليه التفريق بين بعض الألوان.

معززات وهدايا
• ستة معززات تتعرف إليها واحدًا بعد الآخر، ومع كل معزز هدية لتجربه بنفسك: مطرقة، وتبديل حر لا يشترط التطابق، وخلط، وحركات إضافية، وبدايات بقطع خاصة جاهزة على اللوحة.
• القافلة: فُز بالمراحل تباعًا، فتبدأ مرحلتك التالية وعلى اللوحة قطع خاصة بانتظارك.
• هدية اليوم: مكافأة يومية في دورة من سبعة أيام.
• خمسة قلوب: خسارة المرحلة تكلفك قلبًا، ويعود قلب كل 30 دقيقة، والفوز لا يكلفك شيئًا.

العب بدون نت في أي مكان
• لعبة ألغاز مسلية لدقائق الانتظار أو لجلسة طويلة: كل المراحل تُلعب بدون إنترنت ومن دون بيانات الجوال، في الطائرة أو في الطريق.
• لعبة للاعب واحد، وتقدمك محفوظ على جهازك.
• بالعربية والإنجليزية، مع واجهة كاملة من اليمين إلى اليسار. بدّل اللغة متى شئت من الإعدادات.
• رسوم ومؤثرات صوتية صُنعت لهذه اللعبة، وموسيقى هادئة مريحة بلحن يشبه عزف العود.
• للشباب والكبار من عمر 13 سنة فأكثر، ولمحبي ألعاب الألغاز وألعاب المجوهرات والأحجار الكريمة.

المشتريات والإعلانات بوضوح
يمكنك إكمال مراحل زمرد كلها من دون شراء أي شيء. تحتوي اللعبة على مشتريات اختيارية داخل التطبيق: حزم عملات، وحزمة بداية تُشترى مرة واحدة، وخيار يزيل الإعلانات بين المراحل. والعملات تُكسب باللعب أيضًا. وتحتوي اللعبة على إعلانات: إعلانات المكافأة لا تُعرض إلا حين تختار أنت مشاهدتها، والإعلانات بين المراحل قليلة، ولا تقاطع اللعب داخل المرحلة، وتتوقف بعد أي عملية شراء. اللعب نفسه يعمل بلا اتصال بالإنترنت، والاتصال مطلوب للمشتريات والإعلانات فقط.

الزمرد حجر كريم أخضر، ومنه أخذت اللعبة اسمها. الواحة بانتظارك: طابق أول ثلاث جواهر، وانظر إلى أين تأخذك القافلة.
```
<!-- generated:full-ar:end -->

   - Graphics for Arabic: the translation inherits the English graphics unless replaced. Replace them: upload the **Arabic** feature graphic and the 8 + 8 + 8 **Arabic** screenshots listed below. Keep the same app icon (do not upload another icon).
3. Save.

### 4.7. Files to upload, in order

Each entry: repo path — download URL. Screenshots are real captures of the game with a frame and one caption; upload them unchanged.

<!-- generated:assets:begin (written by node store/build-play-console.cjs; do not edit inside) -->
#### Icon (en-US listing only; Arabic inherits it)

| Field | File | Pixels |
|---|---|---|
| App icon | `match3/store/graphics/icon-512.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/graphics/icon-512.png> | 512×512 |

#### en-US — feature graphic

| Field | File | Pixels |
|---|---|---|
| Feature graphic | `match3/store/graphics/feature-graphic.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/graphics/feature-graphic.png> | 1024×500 |

#### en-US — Phone screenshots (1080×1920, upload in this order)

| # | File | Alt text (only if the console offers a description field) |
|---|---|---|
| 1 | `match3/store/screenshots/phone/en/01-match-gems.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/phone/en/01-match-gems.png> | A board of gems in the Dunes world as two special pieces combine and beams of light sweep across rows and columns. |
| 2 | `match3/store/screenshots/phone/en/02-special-pieces.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/phone/en/02-special-pieces.png> | A beam fires along its line in a level of the Bazaar world while other special pieces wait on the board. |
| 3 | `match3/store/screenshots/phone/en/03-six-worlds.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/phone/en/03-six-worlds.png> | The level map at the entrance to the Caverns world, with stars earned on the levels already cleared. |
| 4 | `match3/store/screenshots/phone/en/04-goals.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/phone/en/04-goals.png> | A level of the Palace world with lamps to bring down, chained gems, stone blocks and sand; its goals are in the top bar. |
| 5 | `match3/store/screenshots/phone/en/05-boosters.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/phone/en/05-boosters.png> | The Hammer booster is selected in a level of the Oasis world and the game asks which piece to smash. |
| 6 | `match3/store/screenshots/phone/en/06-rewards.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/phone/en/06-rewards.png> | The level complete dialog with three stars, the score and the coins earned. |
| 7 | `match3/store/screenshots/phone/en/07-offline.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/phone/en/07-offline.png> | A level of the Starlit Sky world just after a long cascade, with the praise word the game shows for it. |
| 8 | `match3/store/screenshots/phone/en/08-languages.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/phone/en/08-languages.png> | The title screen of the game in Arabic: the emblem, the Arabic wordmark and the Play button. |

#### en-US — 7-inch tablet screenshots (1200×1920, upload in this order)

| # | File | Alt text (only if the console offers a description field) |
|---|---|---|
| 1 | `match3/store/screenshots/tablet7/en/01-match-gems.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet7/en/01-match-gems.png> | A board of gems in the Dunes world as two special pieces combine and beams of light sweep across rows and columns. |
| 2 | `match3/store/screenshots/tablet7/en/02-special-pieces.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet7/en/02-special-pieces.png> | A beam fires along its line in a level of the Bazaar world while other special pieces wait on the board. |
| 3 | `match3/store/screenshots/tablet7/en/03-six-worlds.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet7/en/03-six-worlds.png> | The level map at the entrance to the Caverns world, with stars earned on the levels already cleared. |
| 4 | `match3/store/screenshots/tablet7/en/04-goals.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet7/en/04-goals.png> | A level of the Palace world with lamps to bring down, chained gems, stone blocks and sand; its goals are in the top bar. |
| 5 | `match3/store/screenshots/tablet7/en/05-boosters.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet7/en/05-boosters.png> | The Hammer booster is selected in a level of the Oasis world and the game asks which piece to smash. |
| 6 | `match3/store/screenshots/tablet7/en/06-rewards.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet7/en/06-rewards.png> | The level complete dialog with three stars, the score and the coins earned. |
| 7 | `match3/store/screenshots/tablet7/en/07-offline.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet7/en/07-offline.png> | A level of the Starlit Sky world just after a long cascade, with the praise word the game shows for it. |
| 8 | `match3/store/screenshots/tablet7/en/08-languages.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet7/en/08-languages.png> | The title screen of the game in Arabic: the emblem, the Arabic wordmark and the Play button. |

#### en-US — 10-inch tablet screenshots (1600×2560, upload in this order)

| # | File | Alt text (only if the console offers a description field) |
|---|---|---|
| 1 | `match3/store/screenshots/tablet10/en/01-match-gems.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet10/en/01-match-gems.png> | A board of gems in the Dunes world as two special pieces combine and beams of light sweep across rows and columns. |
| 2 | `match3/store/screenshots/tablet10/en/02-special-pieces.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet10/en/02-special-pieces.png> | A beam fires along its line in a level of the Bazaar world while other special pieces wait on the board. |
| 3 | `match3/store/screenshots/tablet10/en/03-six-worlds.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet10/en/03-six-worlds.png> | The level map at the entrance to the Caverns world, with stars earned on the levels already cleared. |
| 4 | `match3/store/screenshots/tablet10/en/04-goals.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet10/en/04-goals.png> | A level of the Palace world with lamps to bring down, chained gems, stone blocks and sand; its goals are in the top bar. |
| 5 | `match3/store/screenshots/tablet10/en/05-boosters.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet10/en/05-boosters.png> | The Hammer booster is selected in a level of the Oasis world and the game asks which piece to smash. |
| 6 | `match3/store/screenshots/tablet10/en/06-rewards.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet10/en/06-rewards.png> | The level complete dialog with three stars, the score and the coins earned. |
| 7 | `match3/store/screenshots/tablet10/en/07-offline.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet10/en/07-offline.png> | A level of the Starlit Sky world just after a long cascade, with the praise word the game shows for it. |
| 8 | `match3/store/screenshots/tablet10/en/08-languages.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet10/en/08-languages.png> | The title screen of the game in Arabic: the emblem, the Arabic wordmark and the Play button. |

#### ar — feature graphic

| Field | File | Pixels |
|---|---|---|
| Feature graphic | `match3/store/graphics/feature-graphic-ar.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/graphics/feature-graphic-ar.png> | 1024×500 |

#### ar — Phone screenshots (1080×1920, upload in this order)

| # | File | Alt text (only if the console offers a description field) |
|---|---|---|
| 1 | `match3/store/screenshots/phone/ar/01-match-gems.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/phone/ar/01-match-gems.png> | لوح من الجواهر في عالم الكثبان لحظة دمج قطعتين خاصتين وأشعة الضوء تكتسح الصفوف والأعمدة. |
| 2 | `match3/store/screenshots/phone/ar/02-special-pieces.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/phone/ar/02-special-pieces.png> | شعاع ينطلق على طول خطه في مرحلة من عالم السوق، وعلى اللوح قطع خاصة أخرى تنتظر دورها. |
| 3 | `match3/store/screenshots/phone/ar/03-six-worlds.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/phone/ar/03-six-worlds.png> | خريطة المراحل عند مدخل عالم الكهوف، وعليها النجوم المكتسبة في المراحل المنجزة. |
| 4 | `match3/store/screenshots/phone/ar/04-goals.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/phone/ar/04-goals.png> | مرحلة من عالم القصر فيها مصابيح يجب إنزالها، جواهر مقيّدة، حجارة ورمال، وأهدافها في الشريط العلوي. |
| 5 | `match3/store/screenshots/phone/ar/05-boosters.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/phone/ar/05-boosters.png> | معزّز المطرقة محدد في مرحلة من عالم الواحة، واللعبة تسأل أي قطعة تُحطَّم. |
| 6 | `match3/store/screenshots/phone/ar/06-rewards.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/phone/ar/06-rewards.png> | نافذة إتمام المرحلة بثلاث نجوم مع النتيجة والعملات المكتسبة. |
| 7 | `match3/store/screenshots/phone/ar/07-offline.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/phone/ar/07-offline.png> | مرحلة من عالم سماء النجوم بعد سلسلة تطابقات طويلة، مع كلمة الثناء التي تعرضها اللعبة. |
| 8 | `match3/store/screenshots/phone/ar/08-languages.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/phone/ar/08-languages.png> | شاشة البداية باللغة الإنجليزية: الشعار واسم اللعبة وزر اللعب. |

#### ar — 7-inch tablet screenshots (1200×1920, upload in this order)

| # | File | Alt text (only if the console offers a description field) |
|---|---|---|
| 1 | `match3/store/screenshots/tablet7/ar/01-match-gems.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet7/ar/01-match-gems.png> | لوح من الجواهر في عالم الكثبان لحظة دمج قطعتين خاصتين وأشعة الضوء تكتسح الصفوف والأعمدة. |
| 2 | `match3/store/screenshots/tablet7/ar/02-special-pieces.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet7/ar/02-special-pieces.png> | شعاع ينطلق على طول خطه في مرحلة من عالم السوق، وعلى اللوح قطع خاصة أخرى تنتظر دورها. |
| 3 | `match3/store/screenshots/tablet7/ar/03-six-worlds.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet7/ar/03-six-worlds.png> | خريطة المراحل عند مدخل عالم الكهوف، وعليها النجوم المكتسبة في المراحل المنجزة. |
| 4 | `match3/store/screenshots/tablet7/ar/04-goals.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet7/ar/04-goals.png> | مرحلة من عالم القصر فيها مصابيح يجب إنزالها، جواهر مقيّدة، حجارة ورمال، وأهدافها في الشريط العلوي. |
| 5 | `match3/store/screenshots/tablet7/ar/05-boosters.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet7/ar/05-boosters.png> | معزّز المطرقة محدد في مرحلة من عالم الواحة، واللعبة تسأل أي قطعة تُحطَّم. |
| 6 | `match3/store/screenshots/tablet7/ar/06-rewards.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet7/ar/06-rewards.png> | نافذة إتمام المرحلة بثلاث نجوم مع النتيجة والعملات المكتسبة. |
| 7 | `match3/store/screenshots/tablet7/ar/07-offline.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet7/ar/07-offline.png> | مرحلة من عالم سماء النجوم بعد سلسلة تطابقات طويلة، مع كلمة الثناء التي تعرضها اللعبة. |
| 8 | `match3/store/screenshots/tablet7/ar/08-languages.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet7/ar/08-languages.png> | شاشة البداية باللغة الإنجليزية: الشعار واسم اللعبة وزر اللعب. |

#### ar — 10-inch tablet screenshots (1600×2560, upload in this order)

| # | File | Alt text (only if the console offers a description field) |
|---|---|---|
| 1 | `match3/store/screenshots/tablet10/ar/01-match-gems.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet10/ar/01-match-gems.png> | لوح من الجواهر في عالم الكثبان لحظة دمج قطعتين خاصتين وأشعة الضوء تكتسح الصفوف والأعمدة. |
| 2 | `match3/store/screenshots/tablet10/ar/02-special-pieces.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet10/ar/02-special-pieces.png> | شعاع ينطلق على طول خطه في مرحلة من عالم السوق، وعلى اللوح قطع خاصة أخرى تنتظر دورها. |
| 3 | `match3/store/screenshots/tablet10/ar/03-six-worlds.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet10/ar/03-six-worlds.png> | خريطة المراحل عند مدخل عالم الكهوف، وعليها النجوم المكتسبة في المراحل المنجزة. |
| 4 | `match3/store/screenshots/tablet10/ar/04-goals.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet10/ar/04-goals.png> | مرحلة من عالم القصر فيها مصابيح يجب إنزالها، جواهر مقيّدة، حجارة ورمال، وأهدافها في الشريط العلوي. |
| 5 | `match3/store/screenshots/tablet10/ar/05-boosters.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet10/ar/05-boosters.png> | معزّز المطرقة محدد في مرحلة من عالم الواحة، واللعبة تسأل أي قطعة تُحطَّم. |
| 6 | `match3/store/screenshots/tablet10/ar/06-rewards.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet10/ar/06-rewards.png> | نافذة إتمام المرحلة بثلاث نجوم مع النتيجة والعملات المكتسبة. |
| 7 | `match3/store/screenshots/tablet10/ar/07-offline.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet10/ar/07-offline.png> | مرحلة من عالم سماء النجوم بعد سلسلة تطابقات طويلة، مع كلمة الثناء التي تعرضها اللعبة. |
| 8 | `match3/store/screenshots/tablet10/ar/08-languages.png` — <https://raw.githubusercontent.com/ahmadkataf/lovable.dev/ccr-bcb81736-74rbji/match3/store/screenshots/tablet10/ar/08-languages.png> | شاشة البداية باللغة الإنجليزية: الشعار واسم اللعبة وزر اللعب. |

<!-- generated:assets:end -->

## 5. App content — privacy policy

The page that lists the app's declarations (Monitor and improve / Policy → **App content**). Answer each item; each one has its own "Start" / "Manage" button.

5.1. Privacy policy: `https://zumurud-privacy.almutafawiqin.workers.dev/` → Save.

## 6. App content — ads

6.1. "Does your app contain ads?" → **Yes, my app contains ads**. Save.
(The bundle contains the Google Mobile Ads SDK. Purchase offers inside the game are not ads.)

## 7. App content — the remaining declarations, one by one

### 7.1. App access (sign-in details)

Choose the option meaning **all functionality is available without any access restrictions** — "All functionality in my app is available without any access restrictions" *(unverified label)*. Enter no credentials. Save.

### 7.2. Content rating (IARC questionnaire)

1. Start questionnaire. E-mail address: **STOP (owner)** — use the Play Console account e-mail.
2. Category: **Game** (the category for games; not "reference", "social" or "utility").
3. Answer by meaning (the exact question wording was not verified):

| # | Topic of the question | Answer | Why |
|---|---|---|---|
| 1 | Violence of any kind (incl. cartoon/fantasy), blood, gore | **No** | abstract jewel puzzle, no characters |
| 2 | Fear, horror, frightening content | **No** | |
| 3 | Sexual content, nudity, suggestive themes | **No** | |
| 4 | Profanity, crude humour, offensive language | **No** | |
| 5 | Drugs, alcohol, tobacco | **No** | |
| 6 | Discrimination, hate | **No** | |
| 7 | Real-money gambling | **No** | |
| 8 | Simulated gambling (cards, dice, slots, betting, wheels of chance) | **No** | the daily gift is a fixed 7-day cycle |
| 9 | Users can interact or communicate (chat, messages, voice) | **No** | single player, no accounts |
| 10 | Users can share content they create | **No** | |
| 11 | Shares the user's location with other users | **No** | |
| 12 | Purchase of digital goods inside the app | **Yes** | coin packs, starter pack, remove ads |
| 13 | Randomised paid items (loot boxes) | **No** | every pack's contents are fixed and stated |
| 14 | Unrestricted internet access / web browser | **No** | |
| 15 | Contains ads (if asked) | **Yes** | |
| 16 | Any other question | **No**, unless it plainly describes the facts above; if unsure **STOP (owner)** | |

4. Save → review the calculated ratings → **Submit**. Expect an "In-Game Purchases" notice; no specific age rating is promised.

### 7.3. Target audience and content

1. Target age groups: tick **13-15**, **16-17** and **18 and over** only. Do **not** tick 5 and under, 6-8 or 9-12.
2. If asked whether the store listing could unintentionally appeal to children: **No** (jewels and geometric ornament; no characters).
3. If a notice says 13-15 / 16-17 may count as children in some locales: read it, keep the selection, and report it to the owner.
4. Save.

### 7.4. Data safety

Answer for the **ads** build.

1. Overview: read, Next.
2. "Does your app collect or share any of the required user data types?" → **Yes**.
3. "Is all of the user data collected by your app encrypted in transit?" → **Yes**.
4. Account creation: choose the option meaning **the app does not allow users to create an account**.
5. Data deletion request (if asked): **No** — the developer holds no user data (privacy policy §6). If the form makes a deletion URL mandatory: **STOP (owner)**.
6. Independent security review / other badges: leave unselected.
7. Data types — tick exactly these four, nothing else:

<!-- generated:data-safety:begin (written by node store/build-play-console.cjs; do not edit inside) -->
| Data category | Data type | Collected | Shared | Processed ephemerally | Required or optional | Purposes (for collection AND for sharing) | Why |
|---|---|---|---|---|---|---|---|
| Location | Approximate location | Yes | Yes | No | Required | Advertising or marketing; Analytics; Fraud prevention, security, and compliance | IP address, collected by the Google Mobile Ads SDK |
| App activity | App interactions | Yes | Yes | No | Required | Advertising or marketing; Analytics; Fraud prevention, security, and compliance | user product interactions, collected by the ads SDK |
| App info and performance | Diagnostics | Yes | Yes | No | Required | Advertising or marketing; Analytics; Fraud prevention, security, and compliance | diagnostic information, collected by the ads SDK |
| Device or other IDs | Device or other IDs | Yes | Yes | No | Required | Advertising or marketing; Analytics; Fraud prevention, security, and compliance | advertising ID and app set ID, collected by the ads SDK |
<!-- generated:data-safety:end -->

8. Do **not** tick: Personal info, Financial info, Purchase history, Precise location, Messages, Photos and videos, Audio, Files and docs, Calendar, Contacts, Web browsing, Health and fitness, Crash logs. (Google Play collects payment data itself; purchase confirmations stay on the device.)
9. For each of the four types the form asks: collected? **Yes**; shared? **Yes**; processed ephemerally? **No**; required or optional? **Required**; purposes: tick the three purposes in the table, for collection and for sharing.
10. Preview → **Submit**.

### 7.5. Advertising ID

"Does your app use advertising ID?" → **Yes**. Purposes: **Advertising or marketing**, **Analytics**, **Fraud prevention, security, and compliance** *(unverified labels; pick these meanings)*. Save.

### 7.6. Government apps

**No** (not developed by or for a government). Save.

### 7.7. Financial features

Choose the option meaning **my app doesn't provide any financial features**. In-app purchases are not financial features. Save.

### 7.8. Health apps

Choose the option meaning **my app does not have any health features**. Save.

### 7.9. News apps

**No** — not a news app. Save.

### 7.10. Anything else on the App content page

The app requests no sensitive permission (no location, SMS, call log, photos, files, accessibility, foreground service, exact alarms). If another declaration appears, answer with these facts; if it does not fit, **STOP (owner)**.

## 8. Countries / regions

The page for where the app is available (Production → Countries / regions).

**STOP (owner)** — ask these three questions and apply the answers:
1. All available countries, or a chosen list?
2. Japan: selling there needs the payments-collection authorisation (announced deadline 1 December 2026), otherwise payouts are held worldwide. Complete it, or exclude Japan for now?
3. EEA and UK: selling there makes the account a "trader" (for a personal account, address and phone become public). Include them, or leave them out for now?

## 9. In-app products (seven one-time products)

Needs: the bundle from step 2 on a track, and a payments profile (step 0.5). If the products page says a merchant/payments profile is missing: **STOP (owner)** (step 10).

Page: Monetize with Play → Products → **One-time products** → Create product. For each of the seven:

1. Product ID: exactly as in the table (it can never be changed or reused).
2. Name and description: English (en-US) as in the table; then add the Arabic (ar) name and description.
3. Purchase option: one option of type **Buy**.
4. Price: enter the suggested US$ base price and let Play Console convert it for all other regions. Keep all regions available. Before the first product, **STOP (owner)** once: "Use these suggested prices?" — use the owner's prices if different.
5. Do not enable multi-quantity.
6. Tax / compliance settings, if shown: keep the defaults for a digital in-game item; if a choice is required, **STOP (owner)**.
7. Save → **Activate**.

<!-- generated:products:begin (written by node store/build-play-console.cjs; do not edit inside) -->
| # | Product ID | Kind | Suggested price (US$) | Name (en-US) | Description (en-US) | Name (ar) | Description (ar) |
|---|---|---|---|---|---|---|---|
| 1 | `coins_small` | consumable | 0.99 | 1,000 Coins | A pack of 1,000 coins. | 1000 عملة | حزمة من 1000 عملة. |
| 2 | `coins_medium` | consumable | 4.99 | 5,500 Coins | A pack of 5,500 coins. | 5500 عملة | حزمة من 5500 عملة. |
| 3 | `coins_large` | consumable | 9.99 | 12,000 Coins | A pack of 12,000 coins. | 12000 عملة | حزمة من 12000 عملة. |
| 4 | `coins_xl` | consumable | 19.99 | 26,000 Coins | A pack of 26,000 coins. | 26000 عملة | حزمة من 26000 عملة. |
| 5 | `coins_mega` | consumable | 49.99 | 70,000 Coins | A pack of 70,000 coins. | 70000 عملة | حزمة من 70000 عملة. |
| 6 | `starter_pack` | non-consumable (entitlement, bought once) | 1.99 | Starter Pack | 4,000 coins, 3 Hammers, 3 Free Swaps and 2 Prisms. Removes ads between levels. One purchase per player. | حزمة البداية | 4000 عملة و3 مطارق و3 تبديل حر و2 منشور، مع إزالة الإعلانات بين المراحل. تُشترى مرة واحدة. |
| 7 | `remove_ads` | non-consumable (entitlement) | 2.99 | Remove Ads | Removes the ads shown between levels. Optional reward videos stay available. | إزالة الإعلانات | يزيل الإعلانات التي تظهر بين المراحل. إعلانات المكافأة الاختيارية تبقى متاحة. |
<!-- generated:products:end -->

The game consumes the coin packs itself and acknowledges `starter_pack` and `remove_ads`; there is no "consumable" switch to set.

License testers (for test purchases without real money): Settings / Manage account → Play apps settings → Monetization settings → **License testing**. E-mails: **STOP (owner)**. (The publishing account itself is always a license tester.)

## 10. Things only the owner does — STOP and hand over

Do none of these yourself. When you reach one, show the page and wait.

| # | Task | Where (by purpose) |
|---|---|---|
| 1 | Accept any legal terms or policy confirmation (Developer Program Policies, export laws, Play App Signing terms, service-fee terms) | wherever a checkbox or "Accept" appears |
| 2 | Identity verification (developer or merchant), if Google asks | account / payments pages |
| 3 | Payments profile (merchant): legal name, address, bank account in Kuwait, bank verification | the payments profile page |
| 4 | US tax form (W-8BEN) | payments profile → tax info |
| 5 | Trader status declaration; a terms-of-service URL if a trader | account details ("About you") |
| 6 | Enrol in the 15% service-fee tier (account group) | associated developer accounts page |
| 7 | Contact e-mail, phone, tester e-mails, content-rating e-mail | steps 2.7, 3.3, 7.2, 9 |
| 8 | Countries (Japan, EEA/UK) and final prices | steps 8 and 9 |
| 9 | Install the internal test on a phone; test purchases with a license tester | owner's phone |
| 10 | The final click that sends the production release for review | step 11.6 |
| 11 | AdMob: link the app to its Play listing after publication; AdMob payments, tax, PIN | AdMob, after step 11 |

## 11. Promote to production

11.1. Confirm with the owner that the internal test was installed and works: **STOP (owner)**.
11.2. Open the Dashboard / publishing overview: every setup task must show as complete (App content items, store listing, store settings). Fix anything open with this file; otherwise **STOP (owner)**.
11.3. Internal testing → the release `1 (1.0.0)` → **Promote release → Production** (or Production → Create new release → add from library → bundle version code 1).
11.4. Release notes: the same block as step 2.5.
11.5. Countries: as decided in step 8.
11.6. Review the release. Resolve any error; warnings: report them to the owner. Then **STOP (owner)**: the owner gives the explicit go-ahead and clicks **Send for review** / **Start roll-out to Production** (or tells you to click it).
11.7. Review can take up to seven days or longer for some accounts. A rejection e-mail: copy the full text and give it to the owner.

## 12. Final checklist

- [ ] App created: `Zumurud: Gem Match 3 Puzzle`, en-US, Game, Free.
- [ ] Internal testing release 1 (1.0.0) published from `Zumurud-1.0.0-ads.aab`; Play App Signing by Google.
- [ ] Store settings: Game / Puzzle; up to five tags from the list; e-mail (owner), website `https://zumurud-privacy.almutafawiqin.workers.dev/`.
- [ ] en-US listing: name, short and full description; icon; English feature graphic; 8 phone + 8 7-inch + 8 10-inch English screenshots in order.
- [ ] ar listing: name, short and full description; Arabic feature graphic; 8 + 8 + 8 Arabic screenshots in order.
- [ ] Privacy policy URL saved.
- [ ] Ads: **Yes**.
- [ ] App access: no restrictions.
- [ ] Content rating submitted (digital purchases: Yes; everything else No).
- [ ] Target audience: 13-15, 16-17, 18 and over.
- [ ] Data safety (ads build): Yes / encrypted / no accounts; four data types, collected and shared, required, three purposes.
- [ ] Advertising ID: Yes.
- [ ] Government No · Financial none · Health none · News No.
- [ ] Seven products created with exact IDs, both languages, Activated (needs payments profile).
- [ ] Countries chosen by the owner.
- [ ] Production release sent for review by the owner's go-ahead.
- [ ] After approval (owner): AdMob app linked to the Play listing; `app-ads.txt` verified in AdMob.

Source documents (for the owner): `match3/store/PUBLISHING-GUIDE.ar.md` (Arabic guide with the reasons behind every answer),
`match3/store/EARNINGS-GUIDE.ar.md`, `match3/store/listing/fields.json`, `match3/store/owner.json`, `match3/store/screenshots/MANIFEST.md`.
