# Game design & architecture

An original, offline, single-player match-3 puzzle game for Android (bundled HTML5 game inside a
Kotlin WebView wrapper). Bilingual: English + Arabic (RTL). No accounts, no backend. The web game
itself never touches the network; monetisation (Play Billing purchases, AdMob ads) is done natively
by the wrapper and reached through a bridge (§7).

**Originality rule (non-negotiable).** The game shares only the *genre mechanics* of match-3. It must not
use the name, characters, artwork, sounds, level layouts, praise words, special-piece names or visual
identity of any existing game. No candy/sweets theme. Never write another game's name anywhere in
code, strings, store text or comments. Vocabulary used here: *gem, beam, nova, prism, sand, stone,
chain, vine, lamp*.

## 1. Architecture

```
match3/
  index.html            single page; #app root
  src/
    main.ts             boot: build AppContext, mount shell
    app/types.ts        AppContext, Navigator, PlayScreen            (contract)
    engine/             pure game logic (no DOM)                      types.ts = contract
    art/                procedural Canvas artwork + icons             types.ts = contract
    audio/              procedural Web Audio sfx + generative music   types.ts = contract
    state/              profile: progress, economy, lives, daily      types.ts = contract
    i18n/               t(), language switching; strings/<namespace>.ts
    platform/           Android bridge / browser fallback             types.ts = contract
    ui/kit/             design system: tokens, buttons, dialogs, toasts
    ui/                 app shell + meta screens (title, map, intro, shop, settings, daily…)
    play/               the play screen: board renderer, animation, input, HUD, result dialogs
    levels/             level data + helpers
  tests/                vitest unit tests (node)  + tests/e2e/*.cjs (Playwright, CommonJS)
  tools/                node scripts (level simulator, asset generators)
  android/              Gradle project (Kotlin WebView wrapper)
  store/                Play listing texts, graphics, privacy policy
```

Conventions (all code):

- TypeScript strict, ES modules. **Relative imports always carry the `.ts` extension**
  (`import { x } from './y.ts'`). Type-only imports use `import type`. **Erasable syntax only**: no
  `enum`, no `namespace`, no constructor parameter properties — so Node 22 can run the sources
  directly (`node tools/x.ts`) and so `tsc --noEmit` (TypeScript 7, `verbatimModuleSyntax`,
  `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`) passes.
- No runtime dependencies besides the bundled font. No frameworks. DOM is built with small helpers.
- No network requests of any kind at runtime (no fetch/XHR/WebSocket, no remote fonts/images/scripts).
  Everything is bundled.
- Target browser: Android System WebView / Chrome **80+**. Vite transpiles JS syntax, but runtime APIs
  and CSS are on you: no `Array.prototype.at`, `structuredClone`, `Object.hasOwn`, `String.replaceAll`;
  CSS: no flexbox `gap` (use margins; grid `gap` is fine), no `aspect-ratio`, no `inset`, no `:is()/:where()`,
  no container queries, no `color-mix()`, no nesting, no `dvh` units, no `:focus-visible`-only styling.
  `clamp()/min()/max()` are fine (Chrome 79). CSS variables are fine.
- The whole UI must work from 320×480 up to tablets, portrait and landscape, with touch AND mouse
  (Pointer Events). Primary target is a portrait phone (360×640 … 412×915 CSS px).
- Performance: 60 fps on a mid-range phone. Canvas work uses cached sprites, no per-frame allocations
  in hot loops, devicePixelRatio capped at 3.
- `tsc --noEmit` and `vitest run` must pass with your module in place. Do not edit files outside the
  paths you own; if a contract needs to change, change as little as possible and report it.
- Commands: `npm run typecheck`, `npm test`, `npm run dev` (http://127.0.0.1:5173), `npm run build`.
  Playwright: `const { chromium } = require('playwright')` from a `.cjs` file (it is installed globally;
  do NOT add it to package.json, do NOT run `playwright install`). `chromium.launch()` needs no options.

## 2. Rules (engine)

Contract: `src/engine/types.ts`. Implementation notes below are binding unless marked *free*.

### 2.1 Board
- Up to 9×9 cells, some may be holes. Gravity pulls down. By default the top-most existing cell of each
  column is a spawner and the bottom-most existing cell of each column is an exit (exits matter only
  for lamps).
- Initial fill: random gems using colours `0..colors-1`, such that the board starts with **no matches**
  and **at least one valid move**. Fixed pieces from the level definition are kept as given.

### 2.2 Swaps
- A move swaps two orthogonally adjacent existing cells. Stones, vines and chained pieces cannot be
  swapped. A lamp can be swapped only if the swap produces a match for the other piece.
- Valid when: (a) either piece is a prism and the other is a gem / beam / nova / prism; or (b) both are
  specials (beam / nova) — a combo; or (c) the swap creates at least one match (3+ in a line) containing
  one of the two swapped pieces.
- Invalid swaps cost nothing and change nothing (`swap` step with `valid: false`).
- A valid swap costs exactly one move.

### 2.3 Matches and specials
- A match is a run of 3+ same-coloured gem-like pieces (gem, beamH, beamV, nova) in a row or column.
  Runs of the same colour that share a cell form one group.
- Special created per group (at most one, best one wins):
  - a straight run of **5 or more** → **prism**
  - an **L / T / +** shape (a horizontal and a vertical run of 3+ sharing a cell) → **nova** (group colour)
  - a straight run of **4** → **beam** (group colour). Orientation: for the wave caused directly by the
    player's swap, the beam points along the swap direction (horizontal swap → `beamH`, clears its row);
    in later cascades, perpendicular to the run.
  - The special appears on the swapped cell if it is part of the group, otherwise on the intersection
    cell (L/T) or the middle cell of the run. Chained members of the group are unchained (see 2.5) and
    do not merge.
- Every other piece of the group is hit with cause `match`.

### 2.4 Special effects
- **beamH / beamV** hit every cell of their row / column.
- **nova** hits the diamond of radius 2 around it (cells with |dc|+|dr| ≤ 2, 13 cells).
- **prism** (when hit by a blast or reached by a combo without a partner colour) picks the most common
  gem colour on the board and hits every gem-like piece of that colour.
- Swap combos (both pieces are consumed; the effect is centred on the destination cell `b`):
  - prism + gem → hit every gem-like piece of that gem's colour (`prism` fx)
  - prism + beam → every gem of that colour becomes a beam (random orientation) (`transform` step),
    then they all fire
  - prism + nova → every gem of that colour becomes a nova, then they all fire
  - prism + prism → `prismAll`: every cell of the board is hit once
  - beam + beam → `cross`: row and column through `b`
  - beam + nova → `bigCross`: rows r-1..r+1 and columns c-1..c+1
  - nova + nova → `bigNova`: the 5×5 square around `b` plus the four cells at distance 3 in line
- A special that is hit (by a match it is part of, or by any blast) fires its own effect — chain
  reactions. Each special fires at most once. Specials triggered by a blast fire in the next
  `activate` + `clear` wave, **before** gravity runs.

### 2.5 What a hit does
| Target | Effect of one hit |
|---|---|
| gem | removed |
| beam / nova / prism | fires (result `activated`), then is removed |
| chained piece | chain breaks (`unchained`), piece stays, does not fire |
| stone | loses one layer (`damaged`), removed at 0 |
| vine | removed |
| lamp | nothing (`none`) |
| sand | a cell that is hit loses one sand layer — unless a stone or vine stands on it (the blocker absorbs the hit) |
| empty cell / hole | nothing |

Adjacent damage: when a group is cleared by a **match**, each stone or vine orthogonally adjacent to any
cell of the group takes one hit with cause `adjacent` (at most one per blocker per wave). Blasts do not
cause adjacent damage (they hit cells directly).

### 2.6 Gravity and refill
- After each wave (all chain reactions done), pieces fall. Stones, vines and chained pieces never move.
- A piece falls straight down into an empty existing cell. A cell that cannot be fed from straight above
  (blocked by an immovable piece or a hole with no spawner) is fed diagonally from the upper-left or
  upper-right neighbour column, so that every reachable empty cell ends up filled.
- Spawners create new random gems (colours `0..colors-1`). Lamp levels spawn lamps per `LevelDef.lamps`.
- After settling, lamps resting on exit cells are collected (`collect` step) and gravity runs again.
- Then matches are searched again (cascade + 1) until the board is stable.

### 2.7 Vines
If the level contains vines and no vine was destroyed during a turn, one vine spreads after the board
settles: a random vine converts one orthogonally adjacent plain gem into a new vine (`grow` step).

### 2.8 No moves left on the board
After a turn settles (and at level start), if no valid move exists the board is shuffled (`shuffle` step):
movable plain pieces are rearranged so that there is no match and at least one valid move.

### 2.9 Goals, winning, losing
- Goals: see `Goal`. `sand`, `stone`, `vine`, `chain` targets are counted from the initial board.
- The level is **won** as soon as every goal is done after a turn settles — except levels whose only
  goals are `score`: those are decided when the moves run out (win if the target is reached; the target
  equals `stars[0]`).
- **Lost** when moves reach 0 after a settled turn with goals unmet. `addMoves(n)` resumes.
- `endBonus()` after a win: for each remaining move, a random plain gem becomes a beam (random
  orientation) (`transform` reason `endBonus`, movesLeft counts down, each worth the end-bonus score), then
  all specials on the board fire and the board cascades until stable. Stars come from the final score
  (minimum 1 star for a won level).

### 2.10 Score (constants in `src/engine/score.ts`, tunable)
- gem removed: `20 × cascade` (cascade multiplier capped at 8)
- special created: beam 60, nova 120, prism 200
- sand layer / stone layer / chain / vine removed: 40 each
- lamp delivered: 500
- end bonus: 250 per remaining move (plus whatever the fired specials clear)

### 2.11 Boosters
- In-level (never cost a move): **hammer** — one hit on a chosen cell (cause `booster`); **freeSwap** —
  swap any two adjacent swappable pieces without needing a match, then resolve; **shuffle** — shuffle.
- Start boosters: **extraMoves** (+3 moves), **prism** (one random plain gem starts as a prism),
  **beamNova** (one beam and one nova placed on random plain gems).

### 2.12 Determinism
Seeded RNG (mulberry32 or similar) owned by the Game. Same level + seed + inputs ⇒ identical steps.

## 3. Visual identity

**Theme:** jewels of a moonlit desert oasis. Deep indigo night skies, warm gold line-work,
geometric eight-pointed-star (khatam) motifs, lanterns, dunes, arches. Elegant and warm, not sugary.

**Palette (tokens):**
- night `#14123a`, indigo `#231f5c`, deep violet `#3a2a7a`
- gold `#f5c95a`, light gold `#ffe7a3`, brass `#b8862e`
- cream text `#fff6dc`, muted text `#c9c2e6`
- success `#3ecf8e`, danger `#ff5d6c`, info `#5ab8ff`

**Gems** — six colours, each with its **own silhouette** so they are distinguishable without colour:

| colour | name | hue | silhouette |
|---|---|---|---|
| 0 | ruby | red `#ff4d5e` | round brilliant (circle with faceted star) |
| 1 | amber | orange/gold `#ffa630` | hexagon |
| 2 | emerald | green `#2fd17c` | square emerald-cut (rounded square with stepped facets) |
| 3 | sapphire | blue `#3d8bff` | teardrop |
| 4 | amethyst | violet `#b05cff` | triangle (trillion, rounded corners) |
| 5 | moonstone | cyan-white `#8ff0ff` | rhombus / kite |

Gems are glossy and faceted: gradient body, darker rim, lighter facets, a soft top-left specular
highlight and a subtle drop shadow. They must read clearly at 36 px and look rich at 96 px.

**Specials:** beam = the gem with a bright white-gold light streak across it (horizontal or vertical) and
small arrow heads at the two ends; nova = the gem inside a pulsing golden ring with four spark points;
prism = an eight-pointed star (two overlapped squares) with a rainbow conic sheen and white core.

**Blockers:** sand = warm translucent grainy layer over the tile (2 layers: thicker, with ripples);
stone = carved sandstone block (3 states of cracks); chain = dark iron chain in an X over the gem with a
small padlock; vine = thorny green knot with a tiny leaf; lamp = brass oil lamp with a small flame.

**Board:** rounded panel with a thin gold frame, cells as a subtle two-tone indigo checkerboard.

**Chapters (20 levels each), backdrops:** oasis (palms, water, moon) → dunes (rolling dunes, sunset
purple/orange) → bazaar (arches, hanging lanterns) → palace (domes, star lattice) → caverns (crystals,
teal glow) → stars (night sky, constellations of khatam stars).

**UI:** rounded gold-trimmed panels on indigo, big friendly buttons (primary = gold with dark text,
secondary = violet outline), font "Baloo Bhaijaan 2" (bundled, Arabic + Latin), generous touch targets
(≥ 48 CSS px). Motion is snappy: 120–250 ms tweens with ease-out/back; nothing blocks input longer than
needed.

## 4. Audio identity
Everything synthesised. Sound effects are short, soft and musical: gem clears are plucked/bell tones
that climb a scale with each cascade; blasts are filtered noise sweeps with a tonal body; UI taps are
soft clicks. Music is a calm generative loop (plucked oud-like lead over a soft drone/pad with light
hand-percussion, in a maqam-flavoured scale such as D Hijaz: D E♭ F♯ G A B♭ C), ~90 BPM for the menu,
slightly livelier for levels. Music sits well under the effects. No melody from any existing work.

## 5. Economy & meta (profile)
Numbers follow the strategy study (docs/STRATEGY.md): coins are scarce enough that a continue is a real
decision, the first session sells nothing, and every system is introduced at its own level.

- **Lives:** max 5, one regenerates every **30 minutes**. A life is lost when a level is failed or abandoned
  after the first move; winning costs none. Refill all lives: **900 coins**.
- **Coins:** start with **2,000**. Level first clear: 20 + 10 per star (levels marked `hard` pay double).
  Replays: 10 per newly gained star.
- **Continue after losing:** +5 moves for **900** coins, then **1,900**, then **2,900** within the same
  attempt (three at most).
- **Boosters** (price of one, in coins): hammer 650, freeSwap 600, shuffle 400, extraMoves 500, prism 800,
  beamNova 650. The player owns none at install; each booster unlocks at a level, where it is introduced
  with a gift so it can be learned by using it. Before its unlock level a booster is not shown anywhere.
  Unlocks: **L7** beamNova ×2 · **L8** hammer ×3 · **L12** freeSwap ×3 · **L14** prism ×2 · **L16** shuffle ×3 ·
  **L19** extraMoves ×2.
- **Feature gating** (the level the player must have reached): lives counter L6 · shop button L10 ·
  rewarded-ad offers L11 · Caravan L20 · interstitial eligibility L25. The daily reward is first offered on
  the player's second calendar day, never during the first session. Nothing is sold in the first session.
- **Caravan (win streak, from L20):** consecutive wins with no fail in between build the Caravan. The next
  level then starts with free specials on the board: after 1 win a beam and a nova; after 2 wins also a
  prism; after 3 or more wins also +3 moves. Failing or abandoning a level resets it. The level intro shows
  the current Caravan and the lose dialog says plainly that giving up will reset it.
- **Daily reward, 7-day cycle** (claim once per local calendar day; missing a day resets the streak):
  1: 100 coins · 2: 1 hammer · 3: 150 coins · 4: 1 shuffle + 1 freeSwap · 5: 200 coins · 6: 1 beamNova ·
  7: 500 coins + 1 prism. (A reward for a booster that is still locked is given as 150 coins instead.)
- Real-money offers and ads: see §7. Everything can also be earned by playing.
- 120 levels in 6 chapters of 20. Level N+1 unlocks when level N is won.

## 6. Screens
Title → Map → Level intro (goals, start boosters) → Play (HUD, board, booster bar) → Win / Lose dialog
→ Map. Overlays: pause, settings (sound, music, vibration, language, privacy policy, credits & licences,
reset progress, version), shop (boosters for coins), daily reward, out of lives, tutorial tips, confirm.
Back button always does the natural thing (close overlay → pause → map → title/exit).

## 7. Monetisation
Contract: `src/monetize/types.ts`. Free to play; the game must be fully enjoyable without paying.

**Purchases (Google Play Billing, one-time products).** Product ids are fixed in the app and must be
created with the same ids in Play Console; prices are set there and the app only shows the store's
localised price string.

| id | kind | grants | suggested price |
|---|---|---|---|
| `coins_small` | consumable | 1,000 coins | US$0.99 |
| `coins_medium` | consumable | 5,500 coins | US$4.99 |
| `coins_large` | consumable | 12,000 coins (badge: popular) | US$9.99 |
| `coins_xl` | consumable | 26,000 coins | US$19.99 |
| `coins_mega` | consumable | 70,000 coins (badge: best) | US$49.99 |
| `starter_pack` | entitlement, once | 4,000 coins + 3 hammer + 3 freeSwap + 2 prism, and removes interstitial ads | US$1.99 |
| `remove_ads` | entitlement | removes interstitial ads (rewarded ads stay available — they are optional) | US$2.99 |

The smallest pack buys one continue with a little left over; larger packs give progressively more coins per
dollar. Prices are set in Play Console; the app only ever shows the store's own localised price string.

Purchase safety: grant once per purchase token, only when PURCHASED, remember granted tokens, finish
(consume/acknowledge) only after the grant is saved, re-deliver unfinished purchases at every start,
restore entitlements at every start and from a "Restore purchases" button in settings.

**Rewarded ads (always opt-in, reward stated on the button, offered from L11):** +3 moves once per
attempt in the lose dialog (fewer than the paid +5); +1 life in the out-of-lives dialog, up to 3 per day;
+50 coins in the shop, up to 3 per day; double the level's coin reward in the win dialog. At most 8
rewarded ads per local day in total.

**Interstitial ads:** only after a level's result dialog is dismissed, on the way back to the map —
never at launch, never on exit/back, never during play, never over a dialog. None until the player has
reached L25 **and** first played at least 3 local calendar days ago; then at most one per 3 finished
levels, at least 180 s after the previous interstitial, never within 10 minutes of a rewarded ad, and at
most 5 per local day. Never for anyone who has bought anything with real money (any product).

**Consent:** the wrapper runs the UMP consent flow before requesting ads; settings shows a
"Privacy options" entry when the consent SDK requires it.

**Builds:** the Android project has two flavours — `plain` (purchases, no ad SDK) and `ads`
(purchases + AdMob, needs the developer's AdMob ids). In a browser the store is unavailable, except
with `?fakestore=1` (or in dev), which simulates products and ads for testing.
