# Store screenshots — audit manifest

Written by `tools/store/make-screenshots.cjs`; do not edit by hand (run the tool again instead).

**What this file proves.** Every screenshot in this folder is a capture of the real, running game:

- the game itself (`index.html` → `src/main.ts`), never the play-demo harness, never a mock-up;
- only shipped levels (`src/levels` `LEVELS`, 120 levels) — the level number is listed for every capture;
- no simulated store: every capture is taken with the store switched off (`fakestore=0`), so no purchase offer, no ad button and no money price can be on screen; the tool checks this on every page and refuses the capture otherwise;
- no debug overlay, no test level list, no `gate=off`: the tool checks these too;
- the state is one a player reaches: a save that stands for normal progress, the level started from its own intro dialog, moves entered through the game's own move handler;
- mid-effect frames are genuine frames: the game runs in real time and is held with its own pause while the screenshot is taken;
- the pixels of a capture are never retouched. The files in `raw/` are the screenshots as taken (re-encoded as 24-bit PNG without alpha). An upload file is its raw capture **scaled as a whole**, with **rounded corners**, a **gold line and a plain background** around it and **one caption** above it — nothing else. `node tools/store/check-kit.cjs screenshots` scales every raw capture again and compares it with the upload file, pixel by pixel.

Game version: `1.0.0`, commit `0c756c6` (with uncommitted edits under `src/` at capture time). Captured: 2026-11-13T21:16:13.169Z. Laid out: 2026-11-13T21:16:43.027Z.

Board coordinates in the "moves" column are (column, row), counted from 0 at the top-left; `(3,5)↔(3,6)` is a swipe between those two cells. The same level, seed and moves give the same board again (the engine is deterministic), so every capture can be reproduced.

## English (en-US) — files to upload

### Phone — 1080×1920

| # | Upload file | Caption | Shows (raw capture) | Language of the capture | Level · world | Seed | Moment | Caption area |
|---|---|---|---|---|---|---|---|---|
| 1 | `phone/en/01-match-gems.png` | Match Gems, Unleash the Light | `raw/en/04-play-combo.png` | en | 28 · Dunes | 1 | move 2 (0,4)↔(1,4) (bigCross×1, prism×1, beamH×1); frame 13 of 46 taken while the effect runs, about 1257 ms after the swipe — chosen as the frame with the most effect light on the board (21.5 % near-white, 36.6 % gem colour) | 6.1 % |
| 2 | `phone/en/02-special-pieces.png` | Fire Beams, Novas and Prisms | `raw/en/05-play-beam.png` | en | 50 · Bazaar | 4 | move 2 (5,3)↔(6,3) (beamV×3, prism×1, nova×1); frame 16 of 39 taken while the effect runs, about 1452 ms after the swipe — chosen as the frame with the most effect light on the board (5.1 % near-white, 29.6 % gem colour) | 6.4 % |
| 3 | `phone/en/03-six-worlds.png` | 120 Levels Across Six Worlds | `raw/en/02-map.png` | en | World map, mid-journey | — | map as it opens, scrolled by the game to the current level 82 | 6.2 % |
| 4 | `phone/en/04-goals.png` | Every Level, a Fresh Puzzle | `raw/en/06-play-blockers.png` | en | 79 · Palace | 7 | start of the level, before the first move | 5.0 % |
| 5 | `phone/en/05-boosters.png` | Boosters for Tricky Moments | `raw/en/07-play-booster.png` | en | 17 · Oasis | 7 | start of the level, Hammer booster tapped: the game asks which piece to strike | 5.6 % |
| 6 | `phone/en/06-rewards.png` | Win Stars and Daily Gifts | `raw/en/09-win.png` | en | 82 · Caverns | 2 | level won in 19 moves (the engine's own hint at every move); result dialog after its stars and score have counted up — 3 stars | 5.2 % |
| 7 | `phone/en/07-offline.png` | Works Offline, Anywhere | `raw/en/08-play-praise.png` | en | 110 · Starlit Sky | 1 | move 2 (3,4)↔(3,5) set off 7 cascades; frame taken while the game shows its praise word "Radiant!" (about 0.4 s after it appears) | 5.1 % |

## Arabic (ar) — files to upload

## Every raw capture

| Raw capture | What | Language | Device viewport | Player save | Level · world | Seed | Start boosters | Moves played | Moment captured | Game flags | SHA-256 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `raw/en/01-title.png` | Title screen | en | 360×640 CSS px × 3 | levels 1–81 cleared, 3450 coins, 5 lives | — | — | — | — | title screen after start-up | still=1 (idle sparkle loops stand still) | `4d3db7be6899e2ab…` |
| `raw/en/02-map.png` | World map, mid-journey | en | 360×640 CSS px × 3 | levels 1–81 cleared, 3450 coins, 5 lives | — | — | — | — | map as it opens, scrolled by the game to the current level 82 | still=1 (idle sparkle loops stand still) | `d520d0c5e26658a5…` |
| `raw/en/03-level-intro.png` | Level intro: goals, Caravan, start boosters | en | 360×640 CSS px × 3 | levels 1–81 cleared, 3450 coins, 5 lives, Caravan streak 2 | 82 | — | — | — | intro dialog of the current level 82 (tap on its map node) | still=1 (idle sparkle loops stand still) | `e6f6b7526ba56700…` |
| `raw/en/04-play-combo.png` | Gameplay: two special pieces swapped — a big combo | en | 360×640 CSS px × 3 | levels 1–27 cleared; level 28 is the current level, played for the first time | 28 · Dunes | 1 | beamNova + prism + extraMoves (brought by the Caravan, streak 3) | (4,2)↔(5,2) (0,4)↔(1,4) | move 2 (0,4)↔(1,4) (bigCross×1, prism×1, beamH×1); frame 13 of 46 taken while the effect runs, about 1257 ms after the swipe — chosen as the frame with the most effect light on the board (21.5 % near-white, 36.6 % gem colour) | seed=1 | `fe77b9b817d9320d…` |
| `raw/en/05-play-beam.png` | Gameplay: a beam fires along its line | en | 360×640 CSS px × 3 | levels 1–49 cleared; level 50 is the current level, played for the first time | 50 · Bazaar | 4 | beamNova + prism + extraMoves (brought by the Caravan, streak 3) | (0,6)↔(1,6) (5,3)↔(6,3) | move 2 (5,3)↔(6,3) (beamV×3, prism×1, nova×1); frame 16 of 39 taken while the effect runs, about 1452 ms after the swipe — chosen as the frame with the most effect light on the board (5.1 % near-white, 29.6 % gem colour) | seed=4 | `da46ec855964e565…` |
| `raw/en/06-play-blockers.png` | Gameplay: lamps, stone, chains, vines and sand on one board | en | 360×640 CSS px × 3 | levels 1–78 cleared; level 79 is the current level, played for the first time | 79 · Palace | 7 | none | — | start of the level, before the first move | seed=7 | `754c137418e6f27a…` |
| `raw/en/07-play-booster.png` | Gameplay: the Hammer booster, choosing where to strike | en | 360×640 CSS px × 3 | levels 1–16 cleared; level 17 is the current level, played for the first time | 17 · Oasis | 7 | none | — | start of the level, Hammer booster tapped: the game asks which piece to strike | seed=7 | `0ea126868b3e81bd…` |
| `raw/en/08-play-praise.png` | Gameplay: a long cascade and the praise word it earns | en | 360×640 CSS px × 3 | levels 1–109 cleared; level 110 is the current level, played for the first time | 110 · Starlit Sky | 1 | none | (3,2)↔(4,2) (3,4)↔(3,5) | move 2 (3,4)↔(3,5) set off 7 cascades; frame taken while the game shows its praise word "Radiant!" (about 0.4 s after it appears) | seed=1 | `37fa3c3abbb2b094…` |
| `raw/en/09-win.png` | Level complete: three stars, score and coins | en | 360×640 CSS px × 3 | levels 1–81 cleared; level 82 is the current level, played for the first time | 82 · Caverns | 2 | none | (2,2)↔(3,2) (4,4)↔(4,3) (4,6)↔(4,5) (6,5)↔(6,4) (4,4)↔(4,5) (4,4)↔(4,5) (5,5)↔(6,5) (4,5)↔(5,5) (5,4)↔(5,3) (3,4)↔(4,4) (5,4)↔(4,4) (3,3)↔(3,4) (3,6)↔(4,6) (4,5)↔(5,5) (2,1)↔(3,1) (2,1)↔(3,1) (1,7)↔(1,6) (1,4)↔(1,5) (2,5)↔(3,5) | level won in 19 moves (the engine's own hint at every move); result dialog after its stars and score have counted up — 3 stars | seed=2, fast=1 (the playthrough runs faster; the dialog is the same) | `2e9f0f169cd887aa…` |
| `raw/en/10-daily-gift.png` | Daily gift: seven-day cycle, day 4 ready | en | 360×640 CSS px × 3 | levels 1–81 cleared, 3450 coins, 5 lives, daily gift of day 4 not yet taken | — | — | — | — | daily gift dialog, day 4 of the seven-day cycle ready to take | still=1 (idle sparkle loops stand still) | `854bfb7325ffff6e…` |
| `raw/en/11-shop-boosters.png` | Shop: boosters priced in coins | en | 360×640 CSS px × 3 | levels 1–81 cleared, 3450 coins, 5 lives | — | — | — | — | shop dialog as it opens: boosters for coins (no store is connected, so no money price exists) | still=1 (idle sparkle loops stand still) | `3728c641d3fabcb5…` |

## Alt text for Play Console (at most 140 characters each)

| # | English | Arabic |
|---|---|---|
| 1 | A board of gems in the Dunes world as two special pieces combine and beams of light sweep across rows and columns. | لوح من الجواهر في عالم الكثبان لحظة دمج قطعتين خاصتين وأشعة الضوء تكتسح الصفوف والأعمدة. |
| 2 | A beam fires down a column in the Bazaar world while a nova and a prism wait on the board. | شعاع ينطلق على طول عمود في عالم السوق، وعلى اللوح نوفا ومنشور ينتظران دورهما. |
| 3 | The level map at the entrance to the Caverns world, with stars earned on the levels already cleared. | خريطة المراحل عند مدخل عالم الكهوف، وعليها النجوم المكتسبة في المراحل المنجزة. |
| 4 | A Palace level with lamps to bring down, chained gems, stone blocks, vines and sand, and its goals in the top bar. | مرحلة في عالم القصر فيها مصابيح يجب إنزالها وجواهر مقيدة وحجارة ونباتات متسلقة ورمال، وأهدافها في الشريط العلوي. |
| 5 | The Hammer booster is selected in an Oasis level and the game asks which piece to smash. | معزّز المطرقة محدد في مرحلة من عالم الواحة، واللعبة تسأل أي قطعة تُحطَّم. |
| 6 | The level complete dialog with three stars, the score and the coins earned. | نافذة إتمام المرحلة بثلاث نجوم مع النتيجة والعملات المكتسبة. |
| 7 | A Starlit Sky level just after a long cascade, with the praise word the game shows for it. | مرحلة في عالم سماء النجوم بعد سلسلة تطابقات طويلة، مع كلمة الثناء التي تعرضها اللعبة. |
| 8 | The title screen of the game in Arabic: the emblem, the Arabic wordmark and the Play button. | شاشة البداية باللغة الإنجليزية: الشعار واسم اللعبة وزر اللعب. |
