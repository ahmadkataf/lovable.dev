# Strategy: how the game follows the genre leader's playbook with its own identity

_Synthesised from four research passes (game feel, level design, retention, monetisation funnel) and then checked by an independent reviewer for intellectual-property and Google Play policy problems. Principles, structures and numbers only — every name, shape, sound and word in the game is our own._

## Executive summary

WHAT MAKES THE LEADER WORK. The evidence shows the market leader is a machine of five interlocking parts, none of which is its artwork.
1. A core move that reacts within 100 ms, hands control back in under a second, and escalates pitch, score and praise with every cascade, while failure stays gentle.
2. A spiky "sawtooth" level curve tuned by pass rate with bots: mostly easy levels, a few labelled hard ones that are short and followed by relief, and every level winnable for free. The leader's own studio says "retention always wins".
3. A few return loops: 5 lives at one per 30 minutes, a daily calendar, a win streak that hands out free starting power, and chests.
4. One currency with a deliberately tight free income. The main sink is "+5 moves" at a near miss, priced at about the smallest pack and rising on each repeat.
5. Restraint: nothing sold and no ads in the first session, opt-in rewarded ads at moments of need, no forced ads for payers, honest prices and timers.

WHERE WE STAND. Our design already has the skeleton: own gems, specials and blockers, the end-of-level bonus, cascade pitch, 5 lives, a 7-day daily cycle, a single currency, an escalating continue, opt-in rewarded ads, store-string prices and a planned simulator. The gaps are mostly numbers and missing loops:
- The economy is about 10x too loose. A continue costs 90 coins against 30-50 coins per win, so a free player affords one every 2-3 wins; comparable games sit at about 14-18 wins.
- Lives regenerate in 20 minutes instead of 30.
- All boosters are handed out at install instead of being taught and gated by level.
- There is no win streak, chest, fair help after repeated fails, or end-of-content loop.
- There are no pass-rate bands, wave template, seed curation or acceptance gates.
- There is no timing table, praise thresholds, finale cap or hint delay.
- Interstitials start at level 10; the evidence supports level 25 and day 3 at the earliest.
- There are five coin packs topping out at 15,000 coins instead of a six-step ladder.
- The look is night-dark throughout, where the genre convention is bright and saturated.

THE PLAN. Twelve musts: (1) responsiveness and forgiving input, (2) feedback and praise tiers, (3) finale, win and fail sequences, (4) pitch ladder and mix, (5) art targets, (6) difficulty architecture, (7) simulator gates and seed curation, (8) lives, (9) the Caravan win streak, (10) economy and pack re-scale, (11) ad and offer policy, (12) first-session flow and gating. Should-items add chests, timed unlimited lives, fair help, the end-of-content mode, the Treasure Jar, the starter offer, notifications and measurement.

OUR OWN IDENTITY. Every system gets our own name: Caravan, Star Coffer, Oasis chest, Journey track, Treasure Jar, Endless Spring, Tailwind, Starlit Trail, sandstorm levels. The gems, backdrops, synthesised Hijaz-key sound and English/Arabic words stay ours.

ON "THE SAME STYLE LITERALLY". The owner asked for the same style, shapes, drawings and sound effects. We match the leader in every measurable property: speed, brightness, saturation, roundness, gloss, escalation, cadence and prices. We do not reproduce its piece shapes, artwork, map, characters, recordings, voice or words. Those are protected, and copying them would breach Google Play's intellectual-property and impersonation rules and risk removal of the app.

LIMITS. Anything needing a server (gifting, tournaments, leagues, live A/B tests, remote tuning) is replaced by a local equivalent or rejected. No source publishes the leader's millisecond timings, and bot-to-human difficulty mapping is game-specific. The timings here are starting estimates to verify by frame-stepping our build, and the pass-rate bands are provisional until the closed test calibrates them. I worked from the four researchers' evidence and opened no sources myself.

## Key numbers

Format: item: new value (old value, if changed). "est." = our estimate, to be tuned.

CORE FEEL (ms, all est.)
- First response to touch: within 100, target 50
- Swap 160; invalid swap 130 out + 130 back; match pop 180
- Fall: 90 x n^0.6 (1 cell 90, 6 cells 264); landing squash 12% for 100
- Simple match, release to control: 600-900
- Cascade speed-up: x0.92 per step, floor x0.60
- Particles: 8 per gem, life 400 or less, 120 live at most
- Shake: 4 px / 200 (special fires), 8 px / 300 (combos); 1 full-screen flash per second at most
- Drag commit: 45% of a cell, on release
- Idle hint: 5,000 (3,000 on L1-10), repeats every 5,000; immediate after 3 invalid swaps
- Praise tiers: cascade 4 / 6 / 8 / 11, or pieces 12 / 18 / 24 / 30; tier 1 about 0.5-1 per level
- Praise banner: 220 in, 900 hold, 200 out
- Low-moves cue at 5 moves
- Finale 5,000 at most, skippable; win dialog interactive within 2,000; stars 300 each
- Retry playable within 1,000; Play tap to board within 1,500; fail-dialog input lock 600

AUDIO
- Pitch ladder, semitones above D4: 0 4 5 7 10 12 16 17 19 22 24 28; hold after step 12
- Peak levels (dB): UI -18, land -16, match -12, blockers -10, specials -8, praise -6, jingles -5, music -20 (ducked 4 more for 600 ms)
- Loudness about -16 LUFS, ceiling -1 dB
- Voices: 3 match, 12 total
- Tempo: menu 90 BPM, level 108 BPM

ART
- Gems: saturation 85% or more, lightness 55-65%, 86-90% of the cell, readable at 32 px
- Contrast against the board: 3:1 or more
- Backdrop saturation 30-40% below gems
- Backdrop lightness by chapter: 60-75% (oasis morning) down to 15-25% (stars night)

LEVELS
- Chapter: 20 levels = 4 waves of 5 (normal, normal, build-up, spike, breather)
- Pass-rate bands: breather 85-100%, normal 55-80%, hard 30-45%, very hard 15-25%; floor 15%
- By range: L1-10 95% or more; L11-20 85-95% (L12 peak 70-80%); L21-40 up to 1.3 attempts; L41-100 1.4-1.6; L101+ 2.0-2.5
- Labelled hard: L35, 49, 59, 69, 89, 104, 109, 114; very hard: L79, 99, 119
- Moves: 30-38 (L1-20), 25-30 (L21-100), 20-27 (L101+), 20-24 on hard levels
- Colours 4 / 5 / 6; 4 element types per board at most; 1 move is about 2 points of pass rate
- Debuts: L2 beam, L3 nova, L4 prism, L5 combos, L6 colour goal, L9 sand, L13 stone, L17 lamp, L22 sand x2, L28 stone x2, L36 chain, L48 stone x3, L62 vine
- Bot: 3 personas x 500 runs (1,000 on hard levels)
- Gates: expert wins 20% or more with no boosters; under 0.2 shuffles per attempt; 3 or more valid moves per turn; close losses 35-60%
- Seeds: 60 candidates x 50 runs; ship the middle 60% plus the easiest 20%
- Stars: 2 stars at the 50th percentile, 3 stars at the 85th
- Tailwind: 3rd fail easy seeds; 5th adds a beam; 8th adds a nova; 95% clear within 10 attempts
- Content: 120 minimum, 200 target; +40 levels per update every 2-4 weeks

RETENTION
- Lives: 5; one per 30 min (was 20); refill 900 coins (was 120); ad life 3 per day
- Caravan: from L20; tier 1 beam, tier 2 + nova, tier 3 + prism; cache every 5 wins after tier 3 (100 coins + 1 tool); resets on a fail
- Daily cycle: 100 coins / hammer / 150 coins / shuffle + freeSwap / 200 coins / beamNova / 500 coins + prism + 30 min Endless Spring
- Journey chests at 8, 15, 22 and 30 total days
- Star Coffer: every 20 stars, from L15 (100 coins + 1 tool)
- Oasis chest: per chapter (200 coins + 1 start booster + 15 min)
- Endless Spring ladder: 15 / 30 / 60 / 120 min
- Notifications: 2 types, 1 per day at most, none 21:00-09:00
- Targets (est.): D1 30%, D7 10%, D30 4% (stretch 40 / 18 / 8); sessions 8-10 min, 4-6 levels, 3-5 a day

ECONOMY (coins)
- Start balance 2,000 (was 150)
- Win: 20 + 10 per star (unchanged); hard x2, very hard x3
- Continue: 900 / 1,900 / 2,900 (was 90 / 150 / 240); +5 moves; 2nd adds a beam, 3rd adds a beam and a nova; 3 per attempt at most
- Booster packs of 3: hammer 1,900; freeSwap 1,700; shuffle 1,200; extraMoves 1,500; prism 2,400; beamNova 1,900
- Free income target: 0.5-0.6 continue a day typical, 1.0 at most for the most engaged

MONETISATION
- Packs (recommended base prices): 1,000 for $0.99; 5,500 for $4.99; 12,000 for $9.99 (popular); 26,000 for $19.99; 70,000 for $49.99; 150,000 for $99.99 (best)
- Old packs: 500 / 1,200 / 3,200 / 7,000 / 15,000
- Traveller's Chest: $1.99, 72 h window, about 5x value
- Treasure Jar: $2.99; +120-160 per win; opens from 2,500; cap 5,000; from L25
- Rewarded ads: from L11; +3 moves (was +5), once per attempt, 3 per day; +1 life, 3 per day; +50 coins, 3 per day; double win coins; 8 per day in total
- Interstitials: from L25 and day 3 (was L10); 1 per 3 levels; 180 s apart (was 150); none within 10 min of a rewarded ad; 5 per day; never for payers
- KPI targets (est.): payer conversion 1% or more, repeat purchase about 25%, rewarded engagement 30% or more of daily players

GATING (level at which each system first appears)
- L6 lives counter; L7 beamNova; L8 hammer; L10 shop icon
- L11 rewarded ads; L12 freeSwap; L14 prism; L15 Star Coffer; L16 shuffle; L19 extraMoves
- L20 Caravan and Oasis chest; L25 Treasure Jar and interstitial eligibility; L35 first sandstorm level
- Session 2: daily reward. Session 3 or first unaffordable continue: starter offer

## Guardrails for builders

- Transfer only mechanics, structures, timings, cadences and numbers. Every name, picture, sound, word and level layout is made by us from scratch.
- Never draw, synthesise, record, write or lay out with another game's screenshot, video, audio or level open as a model. Never sample, ear-match or spectrally match another game's sound. Other games are looked at only for avoidance checks.
- Banned tokens: nothing from the banned list in docs/research/naming-ip.md, and not the word 'saga', may appear in titles, strings, player-visible names, file names, store text, keywords or code comments. Never write another game's name anywhere in the product.
- Our vocabulary only: gem, beam, nova, prism, sand, stone, chain, vine, lamp; hammer, freeSwap, shuffle, extraMoves, beamNova; Caravan, Endless Spring, Star Coffer, Oasis chest, Journey track, Treasure Jar, Traveller's Chest, Tailwind, Starlit Trail, sandstorm level. Any new name passes a store-title search and the banned list before strings freeze.
- Theme lock: jewels in a desert oasis. No sweets, food, toys or cute-animal pieces, no faces or eyes on pieces, no mascot or guide character. Special pieces are marked by our light streak, ring and star, never by stripes on the body, a wrapper, or a sprinkled dark sphere.
- Piece set: no existing game's set may share more than one colour + silhouette pair with ours, and none with the market leader's sets. Redo the comparison sheet whenever a gem changes.
- Map, HUD, dialogs and shop keep the functional order but our composition (caravan trail, khatam medallion nodes, lantern marker, arch header, parchment and gold). Each must pass the blurred greyscale side-by-side test before freeze. If anyone says a screen, sound or word reminds them of a specific game, treat it as a defect and redesign it.
- Words: the praise list is closed (Sparkling / Radiant / Dazzling / Splendour, finale 'Oasis Glow!', with natively written Arabic). No taste or sweets words, and lettering in our own typeface and colours.
- Sound: everything synthesised in our D Hijaz key with our own modal ladder. No one-semitone chromatic ladder, no deep announcer voice, no melody resembling an existing work. Any recorded voice needs a signed rights release and the blind listener test.
- Levels: every board starts from an empty grid and its own one-line brief. The simulator, not imitation, sets difficulty. No layout, mask or goal set is reproduced from any other game.
- Store listing: our own name, icon, screenshots and text. Never name, compare with or hint at another game or brand. No '#1', 'best', 'popular', award or price text in title, icon or developer name. Screenshots show real play. The 13+ declaration is kept credible with no child-directed cues.
- Interstitials only in the level-end slot (result dialog dismissed -> 500 ms 'Ad break' card -> preloaded ad -> map). Never at launch, resume, back or exit, during a level, over a dialog, directly before a board, or back to back. Skip the slot if no ad is ready. No banners, app-open ads, ad notifications or ad-like buttons.
- Rewarded ads are opt-in only, with the action and exact reward on the button. They are never the default or only way forward, the reward is always delivered, and declining costs nothing.
- Honest selling: every price is visible before the tap, and all real-money purchases go through Play billing using the store's own price string. Bonus labels are computed from actual store prices and rounded down. No crossed-out prices, no popularity or scarcity claims, no randomised paid items.
- Honest pressure: timers are real, survive restarts and never restart. Close and decline buttons are visible at once, similar in size and neutrally worded. Dialog buttons ignore input for 600 ms. No purchase prompt is styled as gameplay.
- Fair play: spawn rules and seeds never depend on purchases, coin balance, moves left or how close the player is to winning. The only adjustment is Tailwind, which only helps. Near-miss rates come from static tuning measured by the simulator, never from run-time steering, and the fail dialog shows true numbers.
- Consent and data: no ads SDK start and no ad request before the consent SDK allows it. Analytics run only in the ads flavour, consent-gated and declared in the data-safety form. The web game itself makes no network calls.

## Changes

### [MUST] art-01-direction-targets — Art targets: bright glossy gems, calm dark board, brighter and varied backdrops

*Area:* art · *Owner:* art · *Effort:* medium

Gems: body saturation >= 85% (HSL), body lightness 55-65%, rim 25% darker, top-left specular covering 12-18% of the silhouette plus a thin rim light bottom-right; every silhouette corner rounded (radius >= 12% of gem width, no sharp points on the trillion and kite cuts); gem fills 86-90% of its cell. Rendering stays mineral: faceted and cut like stones, never gummy, sugared, striped, wrapped or food-like, and no faces or eyes on any piece. Test sheet at 32 / 40 / 64 / 96 px in normal, greyscale and simulated protan / deutan / tritan vision: no two gems confusable by silhouette alone. Set originality gate: a comparison sheet lists our six colour + silhouette pairs beside the published piece sets of the ten best-known match games (looked at for avoidance only, never as a drawing reference); no single existing set may share more than one colour + silhouette pair with ours, and none may be shared with the market leader's own sets; the sheet is redone whenever a gem changes. The current set fails this gate (orange hexagon and violet triangle both occur in one long-running jewel match-3 set; green rounded square occurs in a sweets-themed set), so silhouettes are reassigned: ruby = round brilliant (unchanged), amber = trillion (rounded triangle), emerald = hexagon, sapphire = teardrop (unchanged), amethyst = kite, moonstone = cushion (rounded square); DESIGN 3 is updated to match and the gate is rerun on the result. Idle glint: every 5 s a 350 ms diagonal specular sweep crosses the board (40 ms stagger per column). Specials: beam arrow heads must show the axis at 32 px; nova ring pulses on a 1.2 s loop; prism cycles the six gem colours over 2.4 s; special pieces are marked only by our light streak, ring and star, never by stripes across the body or a wrapper around it. Board: panel #1b1748 at 80% opacity, checker tones 3-4% apart in lightness, cell radius 6 px, outer radius 18 px, 2 px gold rim, soft inner shadow; an automated test asserts every gem colour has >= 3:1 contrast against both checker tones. Backdrops follow a time-of-day arc so the game opens bright: oasis = morning (water #2ec4c6, sand #f2d9a0, palm green #3fae5a; mean lightness 60-75%), dunes = golden hour (55-65%), bazaar = dusk with lantern glow (40-50%), palace = blue hour (35-45%), caverns = teal crystal glow (25-35%), stars = night (15-25%). Backdrop saturation 30-40% below the gems, soft focus (no hard edges within 24 px of the board), ambient motion only outside the board (at most 3 elements on 6-12 s loops, off in low-end mode). Setting highContrast repaints the backdrop near-greyscale. All drawings are our own; nothing is traced from or modelled on another game's pieces, map or characters.

*Why:* DESIGN 3 makes every chapter a deep-indigo night scene; the leader's art leads describe bright modern colours, flat 2D against very tactile 3D pieces and a 'craving' test, and casual-art guidance asks for bright clean colour and rounded forms. The dark board is right and stays; the surroundings should start bright and vary. Researcher evidence also gives 3:1 minimum contrast (W3C), 8-10% of males with red-green deficiency, and a competitor teardown on piece size and saturation. Percentages are our measurable translation of those descriptions, not published figures. Review note: a piece set is recognised by its colour-with-shape scheme. The orange-hexagon overlap is confirmed against a published description of a classic jewel set; the violet-triangle and green-rounded-square overlaps are probable and must be confirmed by eye. The reassignment clears every known overlap while keeping the same six silhouettes, so colour-blind legibility is unchanged. The mineral-only rule also keeps the 13+ audience declaration credible, since Play weighs child-appealing imagery when it checks the declared audience.

### [MUST] audio-01-ladder-mix — Cascade pitch ladder in our music key, mix hierarchy, muted-play parity

*Area:* audio · *Owner:* audio · *Effort:* medium

Ladder: sfx('match', {step: n}) plays at semitone offset L[n-1] above D4 (293.66 Hz), L = [0, 4, 5, 7, 10, 12, 16, 17, 19, 22, 24, 28], which is degrees 1-3-4-5-7 of the D Hijaz music key, so every step is in tune with the generative music and avoids the flat-2 and flat-6 clashes against the drone. Steps above 12 hold step 12 and add a sparkle layer (partials at 2x and 3x, -12 dB). The ladder resets on each player move; finale conversions continue it. Variation: 3 round-robin timbre variants of 'match' (detune +/-6 cents, attack 4 / 6 / 8 ms). Lengths: frequent sounds (button, select, swap, match, land) 80-250 ms with attack <= 8 ms; the body of blast sounds sits at 150-400 Hz for phone speakers, nothing essential below 120 Hz. Peak levels relative to full scale: button and popups -18 dB, land -16, select and swap -14, match -12, blockers -10, beam / nova / prism -8, bigCombo -6, praise -6, win / lose / star -5; music bus -20 dB, ducked a further 4 dB for 600 ms under praise, win and lose. Master limiter ceiling -1 dB; integrated loudness about -16 LUFS on a 60 s gameplay capture. Polyphony: at most 3 simultaneous 'match' voices and 12 voices overall (oldest quiet voice stolen); 'land' at most once per 60 ms. Praise: four ascending motifs of 2 / 3 / 4 / 5 ladder notes (step = tier). Additive SfxName: 'finale', 'chest', 'caravan', 'hint'. Level track 108 BPM (menu stays about 90). Parity rule: every audio cue has a visual twin; verified by one full muted playthrough.

*Why:* DESIGN 4 says clears 'climb a scale' but fixes no ladder, levels or voice limits. Researcher evidence: a sound designer's breakdown reports the leader raises the same sound one semitone per step; shipped puzzle titles tie hit notes to the music's key and scale; audio designers advise full-spectrum sounds only for rare moments and variation against ear fatigue; -16 LUFS is one platform's guidance. Our ladder is our own design. Reported sound-on shares range from 8% to over 50%, hence the parity rule. dB values and BPM are our estimates.

### [MUST] economy-01-rescale — Re-scale coins so a continue is a real decision, with a six-step pack ladder

*Area:* economy · *Owner:* state · *Effort:* medium

All constants in src/state/economy.ts. Start balance 2000 (was 150). Win income unchanged: first clear 20 + 10 per star, replay 10 per newly gained star; hard x2, veryHard x3. Continue within one attempt: 900 / 1900 / 2900 coins (was 90 / 150 / 240); 1st = +5 moves; 2nd = +5 moves + 1 beam; 3rd = +5 moves + 1 beam + 1 nova; at most 3, then the level ends; price resets next attempt. Engine (additive): addMoves(n, gifts?). Refill lives 900 (was 120). Boosters are sold in packs of 3 (buyBooster buys a pack): hammer 1900, freeSwap 1700, shuffle 1200, extraMoves 1500, prism 2400, beamNova 1900 (were 60-120 each). No boosters at install; each unlocks at its gating level with one guided use plus 3 free. Daily cycle: day 1 100 coins; 2 one hammer; 3 150 coins; 4 one shuffle + one freeSwap; 5 200 coins; 6 one beamNova; 7 500 coins + one prism (+ 30 minutes of Endless Spring once that item ships). No extraMoves in any free reward. Shop rewarded ad: 50 coins (was 25), 3 per day (was 5). Coin packs (coins; recommended Play Console base price; bonus against the coins_small rate of 1000 coins per US$0.99): coins_small 1000 ($0.99); coins_medium 5550 ($4.99, +10%); coins_large 12150 ($9.99, +20%, badge featured); coins_xl 26300 ($19.99, +30%); coins_mega 70800 ($49.99, +40%); new coins_vault 152000 ($99.99, +50%, badge bestValue). ProductDef.badge becomes 'featured' | 'bestValue' (was 'popular' | 'best'). 'featured' is our own highlight (gold frame plus the computed label) with no wording that claims popularity, sales rank or what other players buy, because an offline game has no such data. 'bestValue' is shown only on the pack with the most coins per unit of the player's actual store price. Bonus labels are computed in code from the grants and the store's own price amounts in the player's currency (additive ProductInfo.priceMicros and currencyCode from the bridge): N = floor(((coins / price) / (coins_small coins / coins_small price) - 1) x 100); the label is shown as '+N%' only when N >= 5, never as a discount, a crossed-out price or a 'was / now' pair; when price amounts are unavailable no bonus label is shown. Use Play's local pricing per country; the app shows only the store string. Target: a typical free player (5-6 wins a day) earns about 0.5-0.6 of a continue per day and the most engaged (12 new levels a day) at most 1.0; if measured income is higher, cut income before raising prices. Every coin gain and spend is tagged with a source or sink id (win, daily, chest, ad, iap, continue1/2/3, refill, booster:<id>) in local stats.

*Why:* Today a continue (90) costs 2-3 wins and the smallest pack (500) buys more than five continues, so neither the continue nor the packs carry value. Researcher evidence: the first continue costs about US$0.89-2.00 for 5 moves across four games and rises on each repeat; comparable games sit at about 14-18 wins per continue; the standard is six packs from about $1 to $100 with the best unit price at the top (+50% to +99%); free boosters are given as 2-3 samples then sold; a starting balance should cover about two continues. Exact coin numbers are our starting values. The price points are recommendations for Play Console, not hard-coded. Review note: against real prices the earlier grants gave +9 / +18 / +28 / +38 / +48%, so the round labels were slightly overstated; grants were nudged so the labels are true at the recommended prices, and labels are now computed from the store's own amounts because local pricing can change the ratios. A 'popular' ribbon is a claim we cannot support, and Play's Payments policy requires clear and accurate pricing information.

### [MUST] feel-01-responsiveness — Responsiveness budget: one timing table, forgiving input, idle hint

*Area:* feel · *Owner:* play · *Effort:* medium

Create src/play/timing.ts as the only place for durations (ms). touchResponse: selected gem scales to 112% in 80 with sfx 'select' on the same or next frame (hard ceiling 100 from touch-down). swap 160 ease-out, dragged gem drawn on top. invalidSwap 130 out + 130 back + 4 px wobble for 80, sfx 'invalid', nothing deducted. matchPop 180 (grow to 115% in 60, shrink to 0 in 120). createConverge 140 + 80 white flash. specialWindup 80; beam sweep 220; nova blast 260; prism rays 30 per target, capped at 420. fall(n cells) = 90 x n^0.6 with gravity ease-in (1 cell 90, 3 cells 174, 6 cells 264, 8 cells 313); column stagger 20, capped at 100 in total; input is re-enabled at touchdown. landSquash 12% for 100 (cosmetic). scorePopup 650 (rises half a cell, fades over the last 250). Cascade speed-up: all durations x0.92 per cascade number above 1, floor x0.60. Budget to verify by frame-stepping a 60 fps capture: release of a simple 3-match to board interactive again in 600-900. Input: drag is primary; the gem follows the finger along the dominant axis (larger of |dx|, |dy|), clamped to one cell; the swap commits on release when displacement is at least 45% of a cell, otherwise it snaps back in 100 and no move is spent, so dragging back cancels. Tap-tap also works: tap lifts the gem with a pulsing 'select' ring, tap on a neighbour swaps, tap elsewhere moves the selection, tap on itself deselects. Hit-testing uses whole cells (nearest cell centre), never the sprite outline. Idle hint: timer starts when the board settles; after 5000 (3000 on levels 1-10) the two gems of one valid move bounce toward each other twice (600) with the 'hint' glow, repeating every 5000; any touch cancels; three invalid swaps in a row show it at once. Levels 1-10 use engine hint(); later levels pick uniformly at random from validMoves() so the hint is help, not the best move. Dev overlay logs touch-to-first-frame and frame time; low-end mode switches on when mean frame time exceeds 22 over 2 s (particles halved, shockwave off).

*Why:* DESIGN 3 only says '120-250 ms tweens'; latency, the per-step budget, the drag commit rule and the hint delay are undefined. Researcher evidence: 100 ms 'instant' and 1 s 'flow' limits (NN/g); the leader's studio describes commit-on-release with drag-back cancel as its dexterity aid; clone tutorials give 0.2-0.3 s swaps and 0.05-0.1 s per cell; teardowns credit the newest genre leader's short animations. No source publishes the leader's own timings, so these are starting estimates. Cells are about 38-40 CSS px on a 360 px phone, below the 48 px guideline, hence whole-cell hit-testing. Hint delay sources disagree (2 s, 'a few seconds', 10 s); 5 s is our choice.

### [MUST] feel-02-feedback-ladder — Four feedback tiers and four praise tiers with our own words

*Area:* feel · *Owner:* play · *Effort:* large

Feedback table in src/play/feedback.ts. T1 plain match: pop, 8 shard particles per gem in gemColor (lifetime <= 400 ms), score popup, sfx 'match'; no shake, no haptic. T2 special created: source gems converge (140), 80 ms white flash on the new piece, pop-in 0 -> 110% -> 100% in 200, its create sound. T3 beam / nova / prism fires: 80 ms wind-up, effect, screen shake 4 px for 200 ms, bass layer. T4 any special + special combo or praise tier 3-4: shake 8 px for 300 ms, one shockwave ring, 120 ms at half time-scale, music accent. Limits: at most 1 full-screen flash per second, shake only at T3+, at most 120 live particles (60 in low-end mode); setting reduceEffects removes shake, flash and shockwave. Collected goal items fly to their HUD goal chip in 350 ms and the chip ticks down; coins fly to the coin counter. A small 'x2, x3...' chain counter shows beside the board from cascade 2. Praise: at most one per move, fired when the chain ends, highest tier reached. Tier 1: max cascade >= 4 or >= 12 gem-like pieces removed in the move; tier 2: >= 6 or >= 18; tier 3: >= 8 or >= 24; tier 4: >= 11 or >= 30. Simulator check: tier 1 must fire 0.5-1.0 times per level for the average bot; shift the piece thresholds by +/-2 until it does. Banner: text over the upper third of the board, 0 -> 110% -> 100% in 220 ms, hold 900, fade 200, never blocks input, with sfx('praise', {step: tier}). Own words (closed list, cleared by the originality review): EN 'Sparkling!', 'Radiant!', 'Dazzling!', 'Splendour!'; AR «بريق!», «تألُّق!», «إبهار!», «بهاء!». Lettering: our bundled typeface, light-gold fill (#ffe7a3) with an indigo (#231f5c) outline and a small khatam spark behind the word; it is not modelled on any other game's praise lettering. Any later change to the list first passes the banned-token list in docs/research/naming-ip.md and a store-title search. Text plus a synthesised motif only; no voice in v1.

*Why:* PLAN mentions particles, shake and praise words but no tiers or thresholds. Researcher evidence: a developer-derived juice framework says feedback must match the importance of the event, and studies found both no juice and extreme juice worse than medium; W3C allows at most 3 flashes per second. Praise thresholds 4/6/8/11 cascades are community-sourced and 12/18/24/30 pieces is an unverified snippet, so the simulator frequency check is the real control. Praise words are ours, not the leader's. Review note: the earlier tier-4 phrase was nearly identical to an existing gem-game store title, so it was replaced by a plain adjective of light; the lettering rule keeps the banner from drifting toward another game's look.

### [MUST] feel-03-level-end — Finale, win and fail sequences: capped, skippable, gentle and honest

*Area:* feel · *Owner:* play · *Effort:* medium

Low moves: when movesLeft reaches 5 the moves numeral turns amber (#ffa630) and pulses 100% -> 120% every 500 ms, with one sfx 'movesLow'. Win finale: input freezes; a banner with our finale phrase (EN 'Oasis Glow!' / AR «وهج الواحة!») shows for 700 ms; then the endBonus() steps play: each remaining move flies from the moves counter to its gem (first 200 ms, each next x0.9, floor 60) while the counter ticks down and the match pitch keeps rising; then all beams fire. The whole finale is time-compressed to at most 5000 ms whatever the moves left; a tap anywhere jumps to the settled state with the full score kept. Win dialog: interactive within 2000 ms of the finale end; stars fill one by one (300 each, sfx 'star' step 1..3), score counts up in 600, coins fly to the counter; exactly one primary button (Next) plus the optional double-coins ad button. The next level is prepared during the finale so Next -> interactive board takes at most 1500 ms. Fail: board dims 40% in 300 ms, sfx 'lose' is a gentle descending 3-note motif (<= 900 ms); no red flash, no buzzer. The dialog shows the real remaining goal items (for example '2 sand left') and, only when true, what a loss costs (one life; Caravan tier N). Buttons: continue for coins (+5 moves, coin price on the button), ad continue (+3 moves) when available, and a plain 'Give up' of similar size visible immediately. All buttons ignore input for 600 ms after the dialog opens. No countdown on any offer. Retry skips the level intro and is playable within 1000 ms. First entry to a level uses a 600 ms board drop-in instead of a blocking goal banner.

*Why:* DESIGN defines endBonus but not its length, skipping or the dialogs. Researcher evidence: teardowns warn against slow unskippable sequences and praise instant retry; the leader's sound designer describes failure feedback as deliberately minimal; a gambling-studies paper shows near-miss framing is powerful, so it must be truthful; regulators flag purchases mistaken for gameplay, hence the input lock and equal-weight exit. Finale cap and dialog timings are our estimates; the 5-move warning is an unverified snippet that matches our existing cue.

### [MUST] levels-01-difficulty-architecture — Difficulty architecture: tiers, pass-rate bands by range, wave template, element roadmap

*Area:* levels · *Owner:* levels · *Effort:* large

LevelDef gains tier: 'breather' | 'normal' | 'hard' | 'veryHard' (hard stays as a derived flag). Bands = predicted human pass rate per attempt with no boosters and no continues: breather 85-100%, normal 55-80%, hard 30-45%, veryHard 15-25%; nothing below 15%. By range: L1-10 at least 95% (on L1-5 a random-move bot must win 100% of runs); L11-20 85-95% except one mild peak at L12 (70-80%); L21-40 mean attempts <= 1.3; L41-100 mean 1.4-1.6; L101+ mean 2.0-2.5. Chapter template (20 levels = four waves of five): normal, normal, build-up (low end of normal), spike, breather. The spike of wave 4 (level 19) is the chapter's hardest; level 20 is a generous breather (>= 95%) that pays the chapter reward. Labelled levels: hard at L35, 49, 59, 69, 89, 104, 109, 114; veryHard at L79, 99, 119 (later chapters: hard at positions 4, 9, 14, veryHard at 19). Before L35 spikes are unlabelled top-of-normal levels (55-65%). Tests enforce: no two hard / veryHard levels adjacent; the level after a spike has pass rate >= spike + 30 points. Moves: L1-20 30-38; L21-100 25-30; L101+ 20-27; hard and veryHard 20-24. Colours: 4 on L1-10 and on blocker-crowded boards, 5 standard, 6 only on open boards. At most 4 element types per board; never the same goal kind more than 3 levels running; two-goal levels from L60. Debut levels: L2 beam, L3 nova, L4 prism, L5 special + special, L6 colour goal, L9 sand (1 layer), L13 stone (1 layer), L17 lamp, L22 sand (2 layers), L28 stone (2 layers), L36 chain, L48 stone (3 layers), L62 vine. Each debut gets 3-5 consecutive teaching levels (the first in the breather band), then rests at least 15 levels before returning in combinations. Tuning order: moves +/-1 (about 2 points of pass rate each), goal quantity, blocker layers, colour count, layout. Map markers: hard = one sandstorm mark (EN 'Sandstorm level' / AR «مرحلة العاصفة»), veryHard = two (EN 'Great sandstorm' / AR «العاصفة الكبرى»); coin reward x2 / x3. Every layout is original by process: each board is drawn from an empty grid in our own tools from its one-line brief (levels-06); no layout, mask, blocker placement or goal quantity is taken from another game's level, screenshot, walkthrough or wiki, and none of that material is open while a level is authored; the brief and the simulator report are the record of where each level came from.

*Why:* DESIGN has a hard flag and '120 levels' but no curve. Researcher evidence: the leader's studio says difficulty is varied on purpose with relief after hard levels, that its harshest early level was both top revenue and top churn, and that 'retention always wins'; a survey found about 1 level in 5 hard and 64% of top games labelling them; published cadences give a new element every 3-5 levels early and slower later; a peer-reviewed paper quotes about 2 points of pass rate per move. Bands, labelled positions and debut levels are our own synthesis, deliberately softer than 2012-2017 practice because an offline game cannot hot-fix a wall. Review note: level layouts are protected expression and Play's Repetitive Content policy bans copying content from other apps, so originality is fixed as a working rule rather than a statement.

### [MUST] levels-02-simulator-gates — Simulator personas, acceptance gates, seed curation, star thresholds

*Area:* levels · *Owner:* levels · *Effort:* large

tools/simulate.ts runs the engine headless with three personas: novice (50% random valid move, otherwise greedy), average (one-move look-ahead scoring goal progress and special creation, 25% random moves), expert (two-move look-ahead). 500 runs per level per persona, 1000 for hard and veryHard. Outputs per level: pass rate, attempts, moves left on wins, goal units left on losses, shuffles, score distribution, praise frequency, per-seed win rate, heat-map of matched cells. Until calibrated, predicted human pass = average-bot pass (trust rank order, treat absolute values as provisional). Calibration during the closed test: 15-30 testers on 40-60 levels across tiers, fit logit(human) = a + b x logit(average bot) + goal-kind term, refit every update. Build-failing gates: predicted pass inside the tier band; expert with no boosters wins >= 20% on every level; mean shuffles per attempt < 0.2 and at most 2% of runs with 2 or more shuffles; mean valid moves per turn >= 3; close losses (within 3 goal units or 3 moves) are 35-60% of losses on normal / hard / veryHard levels; median moves left on wins 1-5 except breathers; attempts divided by close losses < 10; no board region with zero matches in the heat-map. Seed curation: 60 candidate seeds x 50 average-bot runs each; discard the hardest 20%; ship seeds.normal (middle 60%) and seeds.easy (easiest 20%) in the level file (additive LevelDef.seeds); play draws at random from seeds.normal. Stars: stars[0] = pass, stars[1] = 50th and stars[2] = 85th percentile of average-bot winning scores, recomputed on every retune. Engine: initial fill must leave at least 3 valid moves and every shuffle at least 2 (today: 1).

*Why:* PLAN B.9 plans a simulator but no personas, gates or seed handling. Researcher evidence: the leader's published research predicts human pass rate within about 4-6 points from 100-1000 bot runs but with a non-linear, game-specific mapping; one live match-3 saw per-seed win rates from 0.15 to 0.75 on a single level; practitioners treat two shuffles in one attempt as a red flag and require every level to be beatable without boosters. Gate thresholds and star percentiles are our own values; no primary source publishes them.

### [MUST] monetisation-01-ads-offers-policy — Ad and offer policy: moment-of-need only, late and rare interstitials, payers protected

*Area:* monetisation · *Owner:* monetize · *Effort:* medium

Rewarded ads use the opt-in rewarded format only (never the rewarded-interstitial format). Each button shows an ad icon, the action and the exact fixed reward (for example 'Watch an ad: +3 moves'), is never the largest, pre-selected or only way forward, and is hidden when rewardedReady() is false; declining or closing an ad early costs nothing except the reward, and an earned reward is always delivered. They are enabled after L11 is finished. Placements: fail dialog +3 moves (was +5), once per attempt, at most 3 per day; out-of-lives +1 life, at most 3 per day; win dialog double coins; shop +50 coins, at most 3 per day. Global cap 8 rewarded views per local day (replace freeCoinAdsLeft() with rewardedLeft(placement)). Interstitials: none until L25 is finished and at least 2 calendar days have passed since first launch (was L10). There is one slot only, the level-end break: after a result dialog has been dismissed toward the map (Next after a win, Give up after a fail) and before the map is shown. Order when the slot is used: dialog closes -> a 500 ms 'Ad break' card (AR «فاصل إعلاني») with no tappable control -> the preloaded ad -> map -> level intro -> Play. If no ad is preloaded the slot is skipped, never delayed. Never at launch or resume, never on back or exit, never during a level or its finale, never over a dialog, never after the level intro's Play button or before a Retry (no ad may sit directly before a board), never straight after another full-screen ad. At most 1 per 3 finished levels; at least 180 s after any full-screen ad (was 150); none within 10 minutes after a rewarded view; none in a session that contained a purchase flow; at most 5 per day; never for payers. Game audio pauses while any full-screen ad is on screen. One constant INTERSTITIALS_ENABLED lets the owner ship them off. No banners, no app-open ads, no ads in notifications, and nothing in our own UI is styled to look like an ad or the reverse. Payer protection: any completed purchase of any product sets a local payer flag that disables interstitials on this install; rewarded ads stay available. The shop says so in one line ('Any purchase turns off ads between levels on this device'), and the remove_ads card says that it keeps them off after a reinstall, so nobody buys it without knowing the cheaper route. Out-of-coins sheet: tapping a priced button without enough coins opens, in place, a sheet with two choices (the cheapest pack that covers the shortfall and the featured pack) plus close, and one line stating that the original action will then be applied at its shown coin price; after purchase the original action is applied automatically; after cancel the player returns to the same dialog with nothing lost. At most one proactive offer dialog per session, at session start, never during a level and never before L12. Honesty rules: every spend button shows its coin price and every purchase button the store price; nothing is bought without a tap on a priced button; any offer timer is real and survives restarts; an ended offer does not return in the same form; no pre-selected extras; no claim about what other players buy or how many are left; no crossed-out prices; exit buttons are visible immediately and neutrally worded; no randomised paid items; spawn rules and seeds never depend on payment. Consent and audience: the ads SDK is not initialised and no ad is requested until the consent step of ux-01 reports that ads can be requested. The store listing declares a 13+ audience and carries no child-directed cues (no mascots or young cartoon characters, no 'kids' wording); the ad content filter is set to the general-audience level. Fallback kept ready: if Play's review judges the listing child-appealing, remove the elements it names or switch the ads flavour to the mixed-audience set-up (neutral age screen; child-directed tagging and no advertising ID for under-age or unknown ages; analytics off for them) before distribution continues.

*Why:* DESIGN 7 starts interstitials at L10, gives +5 moves by ad (the same as the paid continue), and protects only remove_ads and starter owners. Researcher evidence: the leader runs opt-in rewarded ads only, starts them late and shows none to heavy spenders; rewarded prompts convert 38.1% at the moment of need against 23.8% between levels; platform guidance gives fewer moves by ad than by purchase and 5-10 views a day; Google Play forbids unexpected interstitials; UK and US regulators have fined fake timers and disguised purchases. The owner asked for interstitials, so they stay but under a conservative configuration. The interstitial thresholds are our estimate, not a sourced benchmark. Review note: Play's Ads policy names an ad at the start of a level as a violation and a game's score screen as an acceptable non-interrupting point; the ad network's guidance bans interstitials at load, exit and back to back, warns that an ad after a Next button can surprise, and asks for a pause so the player stops tapping; its rewarded policy requires an unambiguous opt-in with the action and reward stated before each ad. Hence the single slot, the 'Ad break' card and the map between ad and board. Play also weighs child-appealing listing elements against the declared audience, hence the fallback.

### [MUST] retention-01-lives — Lives: one per 30 minutes, fair loss rule, three choices when empty, clock guard

*Area:* retention · *Owner:* state · *Effort:* small

Max 5 lives; +1 every 30 minutes (was 20); full refill in 150 minutes. A life is lost when a level is failed without continuing, or quit after at least one move; quitting before the first move and winning cost nothing; levels 1-5 never cost a life. The counter and countdown appear on the map and level intro from L6. Out-of-lives dialog offers three choices: (1) the countdown to the next life with a 'remind me' button (see notifications); (2) a rewarded ad for +1 life, at most 3 per day, hidden when no ad is ready; (3) refill all for 900 coins (was 120). Clock guard: persist lastWall (epoch ms) and lastElapsed (ms since boot, new bridge call elapsedRealtime()). On resume: if the wall clock is earlier than lastWall, grant nothing, restart the current life's 30-minute timer from now, and keep the daily claim locked until the local day number exceeds the last claimed day; if elapsed >= lastElapsed (no reboot) and the wall clock advanced more than elapsed + 5 minutes, use the elapsed delta instead. Accrual never exceeds 5 lives and one daily claim per local calendar day. Never wipe progress and never show an accusation.

*Why:* DESIGN 5 uses 20 minutes, charges a life for any quit and prices a refill at 120 coins. Researcher evidence: the leader and two major competitors (official help pages) all use 5 lives at one per 30 minutes; analysts recommend at least 10 minutes of free play per sitting and a refill priced near one continue; a competitor's help page shows clock changes are a known issue for offline timers. Guard thresholds and the ad-life cap are our design choices.

### [MUST] retention-02-caravan — Caravan: a win streak that grants free starting specials

*Area:* retention · *Owner:* state · *Effort:* medium

Unlocks when level 20 is won. SaveData.caravan (integer, starts 0) increases by 1 on each first-time win of the frontier level (the highest unlocked level). Replays of cleared levels neither add nor reset. It resets to 0 when an attempt at the frontier level ends without a win (give up, out of moves with no continue, or quit after the first move); a win reached through a continue keeps it. Tier = min(caravan, 3). Tier 1: one beam; tier 2: plus one nova; tier 3: plus one prism, placed on random plain gems at level start, on top of any start boosters the player chose. Engine (additive): GameOptions.gifts?: { beam?: number; nova?: number; prism?: number }, using the same placement path as start boosters. After tier 3, every 5 further consecutive wins (caravan = 8, 13, 18...) grants a Caravan cache: 100 coins + 1 random in-level booster. Caravan rewards never include extra moves. Seeds and spawn rules are identical at every tier. Display: a three-step meter on the level intro, a +1 animation with sfx 'caravan' on the win dialog, and on the fail dialog the line 'Your Caravan (tier N) will turn back' only when N >= 1. Arabic name: «القافلة». Levels are tuned at tier 0.

*Why:* No streak system exists in our design. Researcher evidence: the leader's designers call the win streak 'a core part' of the game; a competitor's official help page describes a 3-stage ladder of start power-ups that resets on a fail; an analyst reports a streak tier lifted that competitor's revenue 1.5x and that a tier granting extra moves failed because it undercut the continue. Unlocking at L20 rather than the competitor's L32 and the cache contents are our choices for a shorter game.

### [MUST] ux-01-first-session-gating — First session straight into play, one system per level, pop-up budget

*Area:* ux · *Owner:* meta-ui · *Effort:* medium

First launch: logo splash of at most 1200 ms, then the level 1 board directly: no title, map, shop, ads, consent wall or notification prompt; language follows the device. Targets: cold start under 5 s, icon tap to first move under 15 s. Consent (ads flavour only): the wrapper refreshes the consent status silently on every launch (no UI, never delaying the first frame); the consent form, when one is required, is first presented at the first ad-eligible moment (on the map after L11 is finished, before any rewarded-ad button is shown), never at first launch; until the consent SDK reports that ads can be requested, the ads SDK is not initialised and no ad is requested; a 'Privacy options' entry appears in settings whenever the consent SDK requires one. L1: one guided first move with a pointing hand, then free play; L2-5 teach one idea each (beam, nova, prism, special + special) on fixed-colour boards by letting the player make it; each tip is one line of at most 60 characters in EN and AR; tips can be skipped from L3. The map first appears after the L1 win; from the second launch the app opens on the map. Gating (system: first appears): lives counter L6; beamNova start booster L7; hammer L8; shop icon L10 (silent); rewarded-ad buttons after L11; freeSwap L12; prism start booster L14; Star Coffer L15; shuffle L16; extraMoves L19; Caravan and first Oasis chest L20; Treasure Jar L25; interstitial eligibility L25 and day 3; first sandstorm level L35. Daily reward: first shown at the start of the second session once L5 is passed. Starter offer: third session or first unaffordable continue, not before L12. Notification pre-prompt: first out-of-lives or after the second daily claim. At most one new system per level, each with a one-screen explanation of at most 2 lines and a free sample. Pop-up budget: at most 1 automatic dialog per return to the map; the rest wait behind badge icons. Level intro has exactly one primary button (Play); Retry skips it; Play tap to interactive board within 1500 ms; no visible loading screens. Each tutorial step is recorded in local stats.

*Why:* DESIGN 6 routes every launch through Title -> Map -> Level intro and gives all six boosters at install. Researcher evidence: platform onboarding guidance says to avoid menus and agreements at launch, show value within 2-3 minutes and delay opt-ins; a level-by-level teardown of a newer genre leader shows boosters unlocked at L7, 8, 14, 17, 19, the first event at L23 and the win streak at L32; one sister title of the leader had to reboot its notifications after some players received about 40 pop-ups a day. The leader's own unlock levels could not be verified, so this schedule is our synthesis. Review note: Google's consent SDK guidance says the consent status should be refreshed on every app launch and that ads cannot be requested until it allows them; a silent refresh keeps the first session free of any consent wall while staying inside that guidance.

### [SHOULD] android-01-notifications — Two local notifications behind a contextual permission prompt

*Area:* android · *Owner:* android · *Effort:* medium

Types: 'lives are full' and 'daily reward is ready', in two channels (lives, daily) so either can be muted. The system permission dialog is shown only after our own pre-prompt, triggered by the 'remind me' button in the out-of-lives dialog or after the second daily claim; if refused, never ask again (a toggle stays in settings). Scheduling uses inexact alarms or periodic background work; no exact-alarm permission is declared. Limits: at most 1 notification per day; none between 21:00 and 09:00 local time (deferred to 09:00); pending ones are cancelled when the app opens. Content is only the player's own game state, in English and Arabic; no ads, no promotion, no system-alert styling. Bridge: notifyPermission(), notifySchedule(kind, atEpochMs, title, body), notifyCancel(kind). Mentioned in the store listing and privacy text.

*Why:* Not in our design. Researcher evidence: Android 13+ turns notifications off by default and Google advises asking in context or after the third or fourth launch; gaming apps lost about a third of opted-in users after that change; exact alarms are denied by default and reserved by Play policy for alarm and calendar apps; the top opt-out reason is frequency. No controlled study isolates local notifications in games. If the schedule is tight this is the first item to move to an update.

### [SHOULD] android-02-measurement — Measurement without a backend: local ledger plus optional analytics events

*Area:* retention · *Owner:* android · *Effort:* medium

Local ledger in SaveData.stats: per level starts, wins, fails, quits, continues by step, attempt number at win; last level played; coin sources and sinks; tutorial steps; rewarded views per placement. Optional analytics only in the ads flavour (the web game still makes no network calls): bridge track(name, paramsJson) forwards to an analytics SDK in the wrapper that queues offline. Events: tutorial_step; level_start; level_end {level, tier, result, attempt, movesLeft, goalsLeft, boostersUsed, continues, seedBand, caravanTier}; lives_empty {choice}; continue_offer {shown, accepted, step, via}; coin_flow {id, amount}; daily_claim {day}; notif_permission {result}; purchase {product}. Declared in the data-safety form and privacy policy and gated by consent. Before each update: retune any level whose real pass rate is more than 10 points outside its band or whose share of 'last level played' is double its neighbours'. First targets: D1 >= 30%, D7 >= 10%, D30 >= 4% (stretch 40 / 18 / 8); payer conversion >= 1%; rewarded engagement >= 30% of daily players; sessions of 8-10 minutes and 4-6 levels.

*Why:* Researcher evidence: the leader's studio continuously reworks its 100 least fun levels from per-level data and warns that 'designing for averages is not a good idea'; a competitor reviews levels 2-3 weeks after release. Benchmarks: Android top-quartile D1 25-27%; typical lifetime payer conversion 1-2%. No puzzle revenue data by country tier or for Arabic-speaking markets was found. The 10-point trigger and our targets are estimates. The owner must accept the privacy implications before this is enabled.

### [SHOULD] art-02-daylight-ui-kit — Daylight UI kit: tactile pill buttons and warm light panels

*Area:* art · *Owner:* meta-ui · *Effort:* medium

Buttons: pill shape (radius = half the height), minimum height 52 CSS px, a 3 px lighter top bevel and a 4 px darker base that compresses 2 px on press in 80 ms; primary = gold with dark text, one primary per dialog; secondary = turquoise outline. Dialogs: radius 24 px, soft shadow, pop-in 0 -> 105% -> 100% in 200 ms. Panels use a warm parchment tone (#fff3d6) with indigo text (#2a2460, contrast at least 7:1), gold trim, and oasis accents (turquoise #2ec4c6, palm green #3fae5a, sunset orange #ff8a3d); indigo stays for the board panel and the night chapters' backdrops. Icons: bold shapes, readable at 20 px. Seasonal reskins stay inside this guide.

*Why:* DESIGN 3 puts gold-trimmed panels on indigo everywhere, which with night backdrops makes the whole game dark. Researcher evidence: the leader's art leads ask for flat, clean 2D UI and a stable, instantly recognisable identity; casual-art guidance asks for gentle curves, rounded shapes and bold icons readable at small sizes. Colours and sizes are our translation into our own palette.

### [SHOULD] feel-04-input-buffer — Buffer one swap while the board resolves

*Area:* feel · *Owner:* play · *Effort:* medium

Input stays live during resolution. Exactly one swap is buffered; it executes on the first frame both of its cells are settled; it expires after 1500 ms. If it is no longer valid at that moment it is dropped silently: no move spent, no invalid animation. A later gesture replaces the buffered one. Phase 2 (could): per-column settle state so swaps are accepted in columns at rest while others still fall.

*Why:* Our engine returns a full step script per turn and play blocks until it ends. Researcher evidence: teardowns list accepting moves during cascades as a core advantage of the newest genre leader and note the drawback of wasted moves, which the silent-drop rule removes. No numeric source exists; the buffer size and expiry are our estimates.

### [SHOULD] feel-05-haptics-map — Sparse, crisp haptics mapped to event importance

*Area:* android · *Owner:* android · *Effort:* small

Bridge call haptic(kind). tick: committed swap (10-20 ms). tickUp(n): cascade 3 and above, amplitude 40% + 10% per step up to 100%. click: special created. thud: special fired (at most 60 ms). double: invalid swap (two soft 10 ms ticks). win: two pulses (40 ms + 60 ms). No haptic for plain matches or landings. The wrapper uses the platform's predefined effects and composition primitives behind capability checks; when unsupported it plays nothing rather than a long one-shot buzz. Haptics fire on the same frame as the visual. Toggle in settings and in the pause menu; the system touch-feedback setting is honoured.

*Why:* DESIGN lists a vibration toggle but no mapping. Researcher evidence: Android's haptics principles say 'less is more', prefer no haptics over buzzy ones, and give 10-20 ms for a good click; a 38-participant study found haptic embellishment improved player experience when synchronised with visuals.

### [SHOULD] levels-03-tailwind — Tailwind: fair, one-directional help after repeated fails

*Area:* levels · *Owner:* levels · *Effort:* medium

SaveData.failStreak counts consecutive failed attempts on the frontier level. Attempts 1-2 draw the seed from seeds.normal. From the 3rd consecutive fail the seed is drawn from seeds.easy (silent). From the 5th: seeds.easy plus one free beam placed at start, shown as a small 'Tailwind' gift chip on the level intro. From the 8th: seeds.easy plus one beam and one nova. Never free moves. Reset on a win. Nobody ever gets seeds harder than the normal band, and the rule never reads purchase history or coin balance. Simulator target: at least 95% of simulated average players clear any level within 10 attempts. Arabic name: «ريح مواتية».

*Why:* No help mechanism exists. Researcher evidence: a publisher's peer-reviewed study on a live match-3 chose easier starting seeds on retries and gained up to 9% play time and 7.9% rounds with neutral revenue, and rejected visible goal changes; the leader's studio has stated that the rules of its game economy are identical for all players. Thresholds 3 / 5 / 8 are our suggestion. Help is given as starting specials, not moves, so the continue keeps its value.

### [SHOULD] levels-04-starlit-trail — Starlit Trail: an honest end-of-content loop

*Area:* levels · *Owner:* levels · *Effort:* medium

After the last level: a celebration and a 'New oases are on the way' screen (no date unless an update is scheduled). Then the Starlit Trail opens: endless rounds drawn from the normal and hard levels from L41 upward, each with a fresh seed from seeds.normal and 2 fewer moves; tier mix equals the late chapters (about 1 in 5 hard, never two hard rounds in a row, no veryHard). Rounds cost lives as usual and the Caravan keeps working. Personal ladder: each round won is one step; a Trail cache (150 coins + 1 booster) every 5 steps; the ladder loops after 50 steps; best streak and best week are shown. It is labelled as a personal challenge; there are no invented opponents. Trail rounds give no stars; replaying main-route levels still feeds the Star Coffer. Arabic name: «درب النجوم».

*Why:* With 120 levels an engaged player reaches the end within about two weeks and today meets a dead end. Researcher evidence: a competitor's official help page describes an end-of-content mode that runs until new levels arrive; analysts say most casual match games recycle their main levels there; the leader's chief scientist reported 75% of players in its last episode had never paid, so difficulty must not spike. Step counts and contents are our choices.

### [SHOULD] levels-05-content-plan — Content plan: 200 levels as the launch target, 40 more per update

*Area:* levels · *Owner:* levels · *Effort:* large

Milestones: 100 tuned levels for the closed test, 120 as the minimum acceptable launch (only together with the Starlit Trail), 200 (10 chapters of 20) as the launch target. Chapters 7-10 reuse the six backdrop themes with a shifted time of day. After launch each app update adds 2 chapters (40 levels) every 2-4 weeks, bundled in the app. Budget 2-4 hours per finished level with the simulator. Pacing check with lives and the difficulty curve: an engaged player needs at least 3 weeks for the launch content. Each update also retunes the 10-20 worst levels by the measurement rules.

*Why:* PLAN fixes 120 levels. Researcher evidence: smaller studios launch with roughly 100-300 levels (the leader itself started with 65), a month of content is the usual bar, new levels arrive weekly to fortnightly at the top, and a finished level takes about 5-8 hours without bot support. The retention researcher's own estimate was 150-200 at launch.

### [SHOULD] levels-06-mix-and-craft — Goal mix, level briefs and craft rules

*Area:* levels · *Owner:* levels · *Effort:* small

Goal mix across the launch set: colour 25%, sand 30%, lamp 15%, blocker-only (stone, vine or chain) 10%, two-goal levels 20% (from L60); score-only goals are used on L1-4 only. Every level has a one-line brief (idea, tier, goal, elements, intended feel) and a row in a master sheet (number, tier, goal, elements, moves, colours, predicted pass, thumbnail). Rules: consecutive levels never share a board mask; boards are symmetric by default; every board region must take part (see the heat-map gate); goal items are visible from the first move. One stat card per blocker (hits to clear, whether it spreads, what clears it, what it blocks) and a compatibility table of allowed element combinations. Special rules are identical in every level; while a special is selected or dragged, the cells it would hit are highlighted faintly within 100 ms.

*Why:* Researcher evidence: an approximate 2022 count of the leader's level types gives about 29% / 21% / 17% / 30% mixed; practitioners require one clear idea per level, differing board shapes for neighbours and a compatibility document; the leader's UX lead says a booster that feels unpredictable is a UX defect. Our split is modelled on that approximate count, not copied from any layout.

### [SHOULD] monetisation-02-treasure-jar — Treasure Jar: bonus coins that build up by winning and open with one small purchase

*Area:* monetisation · *Owner:* monetize · *Effort:* medium

Unlocks at L25. Each first-time level win adds 100 coins + 20 per star (120-160) to SaveData.jarCoins, separate from the balance. Cap 5000. It can be opened only once its content is better value than the plain pack rate at the player's actual store prices (label N >= 5 by the economy-01 formula; 3200 coins at the recommended prices, was 2500), so the jar is never a worse deal than coins_small. Opening is the consumable product jar_open (recommended US$2.99); the jar card always shows its current content and the store price together. Wording presents the content as bonus coins on sale that grow as the player wins; it never calls them 'your coins' or savings, never says they will be lost, and nothing is ever taken away. On purchase the content is granted and a new empty jar starts; the amount is snapshotted when the purchase starts so a pending purchase grants that amount later. When full it stops filling and shows a quiet badge on the map; at most one reminder dialog every 3 days, neutral in tone, with no timer and a close button visible at once. The '+N%' label is computed in code from the content and the actual store prices (about +65% at the cap at recommended prices). Arabic name: «جرّة الكنز».

*Why:* Not in our design. Researcher evidence: a competing home-design match-3 opens its savings bank at the end of day 2 with a 5000-coin cap for $2.99; industry write-ups put the usual price at $1.99-4.99, say most purchases happen when it is full and that it is rarely a first purchase, and stress showing the price upfront. Fill rate and thresholds are our starting estimates; the leader's own thresholds could not be verified. Review note: at the old 2500 threshold the jar cost more per coin than the plain pack (US$2.99 buys about 3020 coins at the base rate) while being presented as treasure, and 'savings' wording implies coins the player already owns; both were corrected so the offer is truthful.

### [SHOULD] monetisation-03-starter-offer — Traveller's Chest: resized one-time starter offer with a genuine 72-hour window

*Area:* monetisation · *Owner:* monetize · *Effort:* small

Product starter_pack stays a one-time entitlement (recommended US$1.99). New grant: 3000 coins + 3 hammer + 3 freeSwap + 3 shuffle + 2 prism + 2 beamNova + 60 minutes of Endless Spring, and it removes interstitials. It never appears before L12. First appearance, whichever comes first: the session-start offer dialog of the third session, or a third card inside the out-of-coins sheet at the first unaffordable continue (the sheet the player opened herself; it never opens as its own pop-up during a level). Afterwards it stays as a shop card and a map icon. The card lists the exact contents and the store price; the value line (about 5x at recommended prices) is computed in code from the contents at pack prices and the actual store price, and is hidden if it cannot be computed; no crossed-out price and no 'last chance' wording. It is available for 72 real hours from first display (clock guard applies, the timer survives restarts and never restarts), shown as a plain remaining-time label without flashing, with no extra dialog as the end approaches, and is then removed for good. Ownership comes from the store entitlement, so it cannot be bought twice or revived by reinstalling. Arabic name: «صندوق المسافر».

*Why:* Today's starter (1000 coins + 8 boosters) was sized for the old coin scale and has no timing rule. Researcher evidence: Google's own guidance places starter packs within sessions 3-5 for a 3-5 day window; a platform guide recommends 3-5x normal value at a low price, one time; a 2024 industry report finds 26.5% of first-time buyers buy again within 30 days. The window must be real because regulators have fined false countdowns. Review note: the unaffordable-continue trigger is confined to the sheet the player opened, so no offer pops up during a level; the value line must be computed, not asserted.

### [SHOULD] retention-03-endless-spring — Endless Spring: timed unlimited lives as a reward

*Area:* retention · *Owner:* state · *Effort:* small

New reward kind { kind: 'unlimitedLives'; minutes: number } and SaveData.unlimitedUntil (epoch ms, protected by the clock guard). The clock starts when the reward is claimed, and the claim button says so ('starts now - claim when ready to play'). While active, the lives counter shows an infinity mark with the countdown, no life is deducted on a loss, and normal regeneration is paused; lives the player already holds are kept. Claims add to the remaining time. Ladder: 15 minutes (Oasis chest), 30 (daily day 7, Journey chest day 22), 60 (Journey chest day 30, starter offer), 120 (reserved for larger paid bundles). Arabic name: «نبع لا ينضب».

*Why:* Not in our design. Researcher evidence: a major competitor's official help pages describe unlimited-lives rewards whose countdown starts on claim; a guide reports one hour per event entry in another. It costs the economy nothing permanent and pulls the player into a longer session. The minute ladder is our estimate.

### [SHOULD] retention-04-reward-tracks — Star Coffer, Oasis chest and the daily Journey track

*Area:* retention · *Owner:* state · *Effort:* medium

Star Coffer (from L15): every 20 stars earned after unlock opens it for 100 coins + 1 random in-level booster (hammer, freeSwap or shuffle); replaying old levels for better stars counts. Oasis chest: on completing each chapter (every 20 levels): 200 coins + 1 start booster (prism or beamNova) + 15 minutes of Endless Spring. Journey track: a count of total daily claims that never resets (SaveData.journeyDays); chests at 8, 15, 22 and 30 total days: 200 coins + 1 booster; 300 coins + 2 boosters; 400 coins + 2 boosters + 30 minutes of Endless Spring; 600 coins + 3 boosters + 60 minutes; then the track restarts. The 7-day cycle still resets on a missed day. Both progress bars show on the map and on every win dialog; chests open with sfx 'chest' and count as the one automatic dialog of that map visit. Arabic names: «خزنة النجوم», «صندوق الواحة», «درب الرحلة». After adding these, re-check the free-income target in economy-01.

*Why:* Our design has only the 7-day cycle. Researcher evidence: a competitor's official help page describes exactly this pairing (weekly streak plus a cumulative login track with boxes at 8, 15, 22 and 30 days); a guide reports a star chest every 20 stars unlocked at level 15 in another top title; the leader's designer credits 'layered systems that give players clear goals beyond individual sessions'. All are counters and work offline. Contents are our estimates sized against the 900-coin continue.

### [SHOULD] ux-02-comfort-settings — Comfort settings: hints, reduce effects, high-contrast backdrop

*Area:* ux · *Owner:* meta-ui · *Effort:* small

Settings (additive keys, also reachable from the in-level pause menu): hints (default on), reduceEffects (default off; removes screen shake, full-screen flashes, shockwave and the half-speed moment), highContrast (default off; near-greyscale backdrop). Existing toggles stay: sound, music, vibration, language. All are stored locally. No countdown-timer levels are ever added to the main route.

*Why:* Researcher evidence: the leader's studio added a greyscale background option, separate audio controls and a dexterity aid in response to player feedback, and phased out timed levels for accessibility; W3C limits flashes to three per second. Our silhouettes already cover colour-blind play, so no extra symbol mode is needed.

### [SHOULD] ux-03-map-hud — Map and HUD conventions in our own composition

*Area:* ux · *Owner:* meta-ui · *Effort:* medium

Map: one continuous vertical route, so the player always sees where she is, drawn in our own look: a caravan trail (a dotted gold line with small lantern posts) crossing the chapter backdrops of art-01, with each chapter entered through an arch. Level nodes are numbered eight-pointed khatam medallions, not round glossy buttons, in three states: done (1-3 stars set on the medallion's lower points), current (1.25x size, pulsing on a 1.2 s loop, carrying the player's marker, a small brass lantern), locked (dimmed 50%); sandstorm marks on hard nodes. No characters, portraits or mascots anywhere on the map. The map opens centred on the current node. After a win the lantern marker glides to the next node in 1000 ms (a tap skips), then the next level intro opens. At most 3 ambient loops (water shimmer, palm sway, birds). HUD (portrait) keeps the functional order: goal chips with remaining counts on the leading side, the moves numeral in the centre at 1.75x other HUD text (the largest numeral on screen), star and score meter on the trailing side; board centred at the widest safe width; bottom tray with the in-level boosters (each at least 48 CSS px with a count badge; at zero the badge becomes '+' and opens the pack purchase) and pause at the trailing end of the tray. It is drawn as our own composition: the top bar is a single gold-rimmed indigo arch with the moves numeral at its apex (inside the lantern frame once art-03 is built), goal chips are parchment tags, and the score meter is a horizontal gold bar with three khatam star marks. Originality check before the layout is frozen and after any later redesign: captures of our map, HUD, win dialog and shop are blurred (8 px) and turned greyscale, then shown to at least 5 people next to the same screens of the five best-known match games; if anyone attributes one of our screens to another game, that screen is recomposed (frame shapes, node shape, placement of secondary elements) and retested. Arabic mirrors leading / trailing and progress-bar direction; the board is never mirrored; moves and score use Western digits in both languages. Test at 320x480, 360x640, 412x915 and with display cut-outs.

*Why:* DESIGN 6 lists the screens without layout rules. Researcher evidence: an analyst describes the leader's map as one continuous track where the player always knows where she is; a 780-person observation study found 49% one-handed use and the screen centre fastest and most accurate; Android's guidance covers right-to-left mirroring. Sizes and durations are our estimates. Review note: the principle (one track, moves numeral dominant, boosters in thumb reach) is free to use, but a map and HUD that look like another game's as a whole are not: the leader's publisher has litigated look-and-feel copies, and Play's Impersonation policy bans in-app elements that imply a link to another app. The functional order stays; the composition, node shape, marker and frames are ours and are tested blind.

### [COULD] art-03-lantern-counter — Lantern moves counter that reacts to danger

*Area:* art · *Owner:* art · *Effort:* small

The moves numeral sits inside a small brass lantern frame of our own design. Its flame is steady above 5 moves, flickers and shrinks from 5 moves down, flares on a win and dims on a fail. No character is needed. New sprites: lanternFrame, flame (3 states).

*Why:* Researcher evidence: a newer genre leader shows a portrait at the top of the screen that reacts to remaining moves, giving a visual twin to the low-moves sound. A lantern does the same job in our own world at a fraction of the cost of an animated character.

### [COULD] audio-02-energy-layer — Adaptive energy layer in the level music

*Area:* audio · *Owner:* audio · *Effort:* medium

The generative level track gets a second layer (hand percussion plus a doubled lead an octave up). It fades in over 800 ms when the Caravan tier is 2 or more or a cascade reaches 4, and fades out over 1500 ms when 5 moves remain or the player is idle for 10 s. AudioApi (additive): musicEnergy(level: 0 | 1).

*Why:* Researcher evidence: the leader's ten-year audio refresh recorded music in stems so the pace can rise on a winning streak and calm down when needed; another puzzle series thins music when the player is idle. Since our music is generative this is one extra voice group, not new recordings. Timings are our estimates.

### [COULD] audio-03-own-voice-callouts — Original spoken call-outs in our own words and a clearly different voice

*Area:* audio · *Owner:* audio · *Effort:* medium

Later phase, and only after an owner decision to relax the all-synthesised rule for these files. Record our own voice talent, separately in English and Arabic (a native Arabic speaker, not a translation read by the English talent), for the four praise words and the finale phrase (5 lines per language, mono, under 300 KB in total). Voice direction is fixed so the result cannot be mistaken for any existing game's announcer: a warm, bright storyteller delivery at natural speaking pitch, 400-900 ms per line, dry or with a short room (reverb tail under 300 ms); no deep or pitched-down announcer voice, no pitch or formant processing, no drawn-out bass delivery, no echo tail. Lines play on top of the synthesised motif, always with the text banner and never without it, with a separate 'voice' toggle. Rights: a written release assigning all rights in the recordings to the owner; no imitation of a named performer; if a synthetic voice is used instead, its licence must allow commercial use and it must not be a clone of an identifiable person. Check before shipping: 5 listeners hear the lines without the picture and are asked which game they come from; if anyone names another game, the take is re-directed and re-recorded.

*Why:* Researcher evidence: the leader pairs short spoken lines with on-screen text and they became catchphrases. This is the one part of its feedback our synthesised audio cannot reproduce. It is not in v1 because it adds recorded assets, two-language production and a review step. Review note: a short praise word spoken by a deep announcer is the leader's most recognisable sound signature, so the idea (speech reinforcing praise) is kept while the performance is specified to be audibly different, with rights and a blind test added.

### [COULD] levels-07-new-elements — One new original element per two chapters after launch

*Area:* levels · *Owner:* engine · *Effort:* large

After the launch set, each second chapter introduces one new element of our own invention, with a stat card, a compatibility-table entry, 3-5 teaching levels and full simulator coverage before it ships. The engine contract grows additively (new PieceKind or floor value and matching Hit results). Candidates are chosen at that time and pass the originality review before art is drawn.

*Why:* Our five blocker families cover debuts up to about L62. Researcher evidence: a major competitor went from 16 mechanics over 300 levels at soft launch to 29 over 1,300 six months later, with a new element about every 25-50 levels in the late game.

### [COULD] monetisation-04-local-offer-tiers — Local offer tiers and three extra rewarded placements

*Area:* monetisation · *Owner:* monetize · *Effort:* medium

Offer tier kept on the device: never paid / paid once / paid three or more times; it only selects which pack is highlighted as 'featured' in the out-of-coins sheet and the session-start offer (coins_small / coins_large / coins_xl). Every player sees the same products at the same store prices and every pack stays visible in the shop; the tier never reads fail counts, lives or how close a loss was, and never changes prices, grants, spawn rules or seeds. Extra rewarded placements inside the 8-per-day cap, each naming its exact reward on the button: one free beamNova start booster on the level intro after two fails on that level; double the daily reward; recover a missed day of the 7-day cycle once per cycle. Optional second line under coin prices with the approximate real-money equivalent at the base pack rate, switchable by region (needs price amount and currency code from the bridge). Change one variable per release and compare cohorts by install week.

*Why:* Researcher evidence: an industry guide describes offer tiers that move up after a purchase and down after about a week without one; platform guidance lists pre-level bonus and daily-bonus doubling as standard rewarded placements; non-binding 2025 EU guidance asks for real-money price indication. Anchors and decoys give only small increments compared with core fun, so this is low priority. Review note: the tier is limited to highlighting so it cannot become personalised pricing or target a player in distress, and the ad network's rewarded policy requires the reward to be stated before each ad.

### [COULD] retention-05-local-events — Two local events: Weekend Oasis and the Long Road

*Area:* retention · *Owner:* state · *Effort:* medium

Both run on the device calendar and the player's own progress, from L25. Weekend Oasis: Friday 00:00 to Sunday 23:59 local time, Star Coffer progress counts double. Long Road: win 7 frontier levels in a row within 24 hours for a chest (300 coins + 1 start booster + 15 minutes of Endless Spring); it reuses the Caravan counter and can be started once per day. Each event has one map icon with a real countdown and no pop-up beyond the first explanation. Arabic names: «واحة نهاية الأسبوع», «الطريق الطويل».

*Why:* Researcher evidence: a newer genre leader starts its first event at L23 and layers daily, weekly and longer goals; analyst estimates put solo event lifts at +9% to +12% of 30-day revenue (uncontrolled). Friday is part of the weekend in much of our Arabic-speaking market. Only worth building after lives, Caravan, daily reward and chests are finished.


## Already covered by the design

- Invalid swap costs nothing and animates there-and-back with its own soft sound (DESIGN 2.2, swap step valid:false, sfx 'invalid')
- Every gem colour has its own silhouette, so pieces are readable without colour; beam and nova keep the base cut and colour, prism is a distinct colourless star (DESIGN 3)
- Calm dark two-tone checker board panel with a thin gold frame that makes gems pop (DESIGN 3)
- All levels are move-limited; there are no timed levels (DESIGN 2.9)
- Leftover moves convert into specials that fire automatically after a win, with score per remaining move (endBonus, DESIGN 2.9 and 2.10)
- Cascade score multiplier grows per cascade step and resets each move (20 x cascade, capped at 8)
- Match sound climbs a scale with each cascade step (audio contract: 'match' with opts.step); only the exact ladder is a change
- Automatic shuffle when no move exists, never forcing a booster (DESIGN 2.8)
- Seeded deterministic engine, which makes bot simulation and seed curation possible (DESIGN 2.12)
- Lives pool of 5, spent only on a loss, winning is free (DESIGN 5); only the regeneration time and the quit rule change
- Daily reward on a 7-day cycle keyed to the local calendar day, a missed day resets the cycle, fixed calendar rather than a random wheel (DESIGN 5)
- One purchasable currency (coins) prices every sink; no second premium currency and no currency exchange (DESIGN 5 and 7)
- Continue is +5 moves with a price that rises within the same attempt in three steps and resets next attempt (DESIGN 5); only the price level changes
- Prices shown are always the store's own localised strings; offers are hidden when billing is unavailable; the game stays playable offline (monetize contract)
- Purchase safety: grant once per token, only when purchased, finish after saving, restore at start and from settings (DESIGN 7)
- Rewarded ads are strictly opt-in with the reward stated on the button: extra moves in the lose dialog, +1 life when out of lives, capped free coins, double win coins (DESIGN 7)
- Interstitials only after a result dialog is dismissed, never at launch, exit, during play or over a dialog, with a frequency cap, and never for owners of remove_ads or the starter pack (DESIGN 7); thresholds are tightened in the change list
- A remove-ads product and a one-time starter bundle exist (DESIGN 7)
- Consent flow before any ad request and a privacy-options entry in settings (DESIGN 7)
- Hard levels can be marked on the map (LevelDef.hard); the change list adds a second tier
- Low-moves warning at 5 moves exists as a sound cue ('movesLow')
- Stars are score thresholds per level, one star equals passing, and stars never gate progress (DESIGN 2.9 and 5)
- A level simulator that plays each level hundreds of times and checks winnability is already planned (PLAN B.9)
- Per-level tutorial ids and fixed-colour tutorial boards exist (LevelDef.tutorial, pieces 'a'..'f')
- Touch targets of at least 48 CSS px and snappy 120-250 ms eased tweens are design rules (DESIGN 3)
- English and Arabic with right-to-left layout and a bundled Arabic + Latin font (DESIGN 3)
- Separate sound, music and vibration toggles (settings)
- Separate calm menu and livelier level music, all original and synthesised, with music mixed under effects (DESIGN 4)
- Blockers show remaining layers with distinct states: stone 3 states, sand 2 layers (DESIGN 3)
- Chapters of 20 levels with their own backdrop, inside the 15-20 range the evidence supports (DESIGN 3 and 5)
- Linear level unlock with no time gates or pay gates between chapters (DESIGN 5)
- Engine hint() and validMoves() exist for the idle hint and the bots (engine contract)
- No randomised paid items or loot boxes anywhere in the design
- Praise sound with four intensity tiers exists in the audio contract ('praise' step 1..4); thresholds and words are defined in the change list

## Deliberately not adopted

- Reproducing the leader's piece shapes, artwork, map look, characters, music, sound recordings, voice lines, praise words, booster names or level layouts: protected expression; breaches Google Play intellectual-property and impersonation policy and risks removal. We match measurable style properties instead.
- A sweets theme or any look close to the leader's trade dress: unnecessary legal and store-review risk; the jewels-and-oasis identity stays.
- Recorded voice call-outs in the first release: conflicts with the all-synthesised audio rule and needs two-language recording; replaced by text plus a synthesised motif, with our own recorded voice kept as a later option.
- Friend or team life gifting, teams, tournaments, leagues and real leaderboards: need a server.
- Leaderboards or races against invented opponents presented as real people: deceptive; the end-of-content ladder is labelled as a personal challenge.
- Chapter gates that require friends, payment or a wait: need social features, and the leader itself relaxed them.
- Timed (countdown) levels: the leader's studio phased them out as unfit for a relaxed game and unfair to slower players.
- Walls with 5-10% pass rate: the leader's own data shows its hardest early level produced the most revenue and the most churn; our floor is 15%.
- Changing difficulty, seeds or drops according to whether a player has paid, rigging randomness to cause a loss, or manufacturing near-misses: unfair, a regulatory risk, and contrary to the leader's own stated rule of identical rules for all players.
- Free extra moves in streak, daily or help rewards: evidence shows it undercuts the continue, the main sink.
- A streak-freeze item: analysts note it would cut continue revenue and weakens the stakes that make the streak work.
- Season pass and collection album in the first release: they pay off only with more content and audience; revisit after launch.
- Random reward wheel, loot boxes or any randomised paid item: odds-disclosure duties and regulatory risk; the fixed calendar and fixed chest contents are transparent.
- A second premium currency, currency exchange or direct real-money item sales beside coins: regulators treat layered currencies as obscuring real cost.
- Countdown timers on the continue offer, invented discount tags and recurring 'last chance' offers: fined by consumer regulators; only genuine windows are used.
- Banner ads on the board, app-open ads, interstitials at level start, mid-level or on exit: against store and ad-network policy and the leader's practice.
- Removing rewarded ads for payers: rewarded ads are opt-in and wanted; only forced ads are removed.
- Server-side A/B tests, remote configuration and a seven-tier personalised offer system: need a backend; replaced by install-week cohort comparison and an optional three-tier local version.
- A playtest agent trained on recorded human moves: needs player data we do not have; heuristic personas plus calibration in the closed test are used.
- Exact-alarm notifications: denied by default on current Android and reserved by Play policy for alarm and calendar apps; inexact scheduling is enough.
- Notification permission prompt at first launch and more than one notification a day: platform guidance and opt-out data argue against both.
- Reward lives stored above the cap of 5: adds a second lives rule; timed unlimited lives cover the same need.
- Ad-heavy loads typical of ad-first puzzle games (dozens of interstitials per user): an IAP-first game should not copy them.
- Live-recorded adaptive soundtrack with stems and session musicians: out of scale; a synthesised energy layer covers the principle.
- Extra colour-blind symbol mode engraved on gems: our six distinct silhouettes already carry the information.
- Publishing a per-country revenue forecast: no puzzle revenue data by country tier or for Arabic-speaking markets was found, so any figure would be a guess.

## What the IP/policy review rewrote

Largely clean, with 12 of 32 items corrected. No item copies another game's artwork, recordings, characters, level layouts, name or logo, and every feature name and praise word is ours. The corrections fall into three groups.

Originality: (1) our colour + silhouette set overlapped existing piece sets; (2) the map and HUD item described the genre leader's familiar arrangement with no own-look rule; (3) the spoken call-out item had no operational safeguard against the leader's announcer signature; (4) one praise word nearly matched an existing gem-game store title; (5) two items used the word 'saga', which the project's own trademark notes (docs/research/naming-ip.md) record as a registered mark of the leader's publisher.

Play and ad-network compliance: (6) the interstitial slot could land directly before a board, which Play's Ads policy lists as a violation; (7) consent timing was looser than Google's guidance; (8) the 13+ declaration had no fallback if Play judges the listing child-appealing.

Honest selling: (9) a 'popular' badge with no sales data behind it; (10) bonus percentages that were 1-2 points overstated against real prices; (11) a jar that could be opened at worse value than the plain pack; (12) a starter offer that could pop up mid-level.

The owner's wish to reproduce the leader's shapes, drawings and sound effects literally is not carried out. That would breach Play's Intellectual Property, Impersonation and Repetitive Content policies ('We don't allow apps that merely provide the same experience as other apps already on Google Play'). The strategy itself (feel, pacing, retention, economy, monetisation) is transferred in full with original expression.

Limits: this is a policy and originality review, not legal advice. Trademark-register searches for our new feature names were not run. The sweets-set piece shapes come from a search summary only (the fan wiki returned HTTP 402), so that comparison must be confirmed by eye.

Pages opened:
- Impersonation: https://support.google.com/googleplay/android-developer/answer/9888374
- Intellectual Property: https://support.google.com/googleplay/android-developer/answer/9888072
- Spam / Repetitive Content: https://support.google.com/googleplay/android-developer/answer/9899034
- Metadata: https://support.google.com/googleplay/android-developer/answer/9898842
- Ads: https://support.google.com/googleplay/android-developer/answer/9857753
- Deceptive Behavior: https://support.google.com/googleplay/android-developer/answer/9888077
- Payments: https://support.google.com/googleplay/android-developer/answer/9858738
- Families: https://support.google.com/googleplay/android-developer/answer/9893335
- Target audience: https://support.google.com/googleplay/android-developer/answer/9867159
- AdMob disallowed interstitials: https://support.google.com/admob/answer/6201362
- AdMob recommended interstitials: https://support.google.com/admob/answer/6201350
- AdMob rewarded policies: https://support.google.com/admob/answer/7313578
- Consent SDK: https://developers.google.com/admob/android/privacy
- Classic jewel piece set: https://bejeweled.wiki.gg/wiki/Gem

Project files read: /home/user/lovable.dev/match3/docs/DESIGN.md, /home/user/lovable.dev/match3/PLAN.md, /home/user/lovable.dev/match3/docs/research/naming-ip.md, /home/user/lovable.dev/match3/src/monetize/types.ts.

- **feel-02-feedback-ladder** — The tier-4 praise 'Jewel Storm!' is nearly identical to the title of an existing gem match-3 on the stores ('Jewels Storm Match' turned up in a title search). The banner lettering was unspecified, so builders could drift toward another game's praise lettering. → Tier 4 becomes 'Splendour!' / «بهاء!». The word list is closed and cleared by this review. Lettering is fixed to our bundled typeface in light gold with an indigo outline and a khatam spark. Any later word passes the banned-token list in docs/research/naming-ip.md and a store-title search.
- **art-01-direction-targets** — Colours-with-shapes overlap. In docs/DESIGN.md section 3 our orange hexagon matches the classic jewel match-3 set (confirmed on its fan wiki: red square, orange hexagon, yellow rhombus, green round, blue diamond, purple prism, white sphere). Our violet triangle probably matches the same set, and our green rounded square probably matches a sweets-themed set (green 'pillow'; from a search summary, unverified). The item also pushed brightness and gloss with no rule against sweets-like rendering, which also weakens the 13+ audience declaration (Play: child-appealing imagery 'may impact Google Play's assessment of your declared target audience'). → Added a set-level gate: no existing set may share more than one colour + silhouette pair with ours, and none with the market leader's sets. Added a concrete reassignment that clears every known overlap: ruby round, amber trillion, emerald hexagon, sapphire teardrop, amethyst kite, moonstone cushion. Added mineral-only rendering rules: no gummy, striped, wrapped or food-like look, and no faces.
- **levels-01-difficulty-architecture** — 'Every layout is original' was a statement with no process behind it. Level layouts are protected expression, and Play's Repetitive Content policy bans 'copying content from other apps'. → Replaced by a provenance rule: every board is drawn from an empty grid from its own one-line brief, and no layout, mask, blocker placement or goal quantity is taken from another game's levels, screenshots, walkthroughs or wikis. The brief is the record.
- **economy-01-rescale** — A 'popular' badge is a popularity claim that an offline game has no data to support. The '+10 / 20 / 30 / 40 / 50%' labels were overstated: against real prices the grants give +9 / +18 / +28 / +38 / +48%. With Play's local pricing a label computed from US prices can be false in the player's currency. The Payments policy requires clear and accurate pricing information. → Badges become 'featured' (our own highlight, no popularity wording) and 'bestValue' (shown only where arithmetically true at the player's store prices). Labels are computed from the store's own price amounts (additive ProductInfo.priceMicros and currencyCode), rounded down, shown only from +5%, never as a discount or crossed-out price. Grants were nudged to 5550 / 12150 / 26300 / 70800 / 152000 so the round labels are true at the recommended prices. src/monetize/types.ts badge type changes accordingly.
- **monetisation-01-ads-offers-policy** — (a) The interstitial was allowed 'after a result dialog is dismissed' while other items let Next lead straight to a board. That can put an ad at the start of a level, which Play's Ads policy lists as a violation. AdMob guidance also warns that ads 'after a Next button can be surprising' and asks for a pause so the player stops tapping. (b) Rewarded buttons lacked the required statement of action and reward, and the rewarded-interstitial format was not excluded. (c) The out-of-coins sheet named a 'popular' pack. (d) Any purchase removes interstitials while remove_ads is still sold, with no disclosure. (e) Nothing stopped the ads SDK from starting before consent. (f) The 13+ declaration had no fallback if Play judges the listing child-appealing. → One slot only: dialog dismissed -> 500 ms 'Ad break' card with no tappable control -> preloaded ad -> map -> level intro -> Play. No ad may sit directly before a board, at launch, resume, exit or back, over a dialog, or back to back; the slot is skipped if no ad is ready. Rewarded is the opt-in format only, with action and exact reward on the button. The 'featured' pack replaces 'popular'. The shop discloses that any purchase turns off ads between levels on this device and what remove_ads adds. No ads SDK start or ad request before consent allows it. A mixed-audience fallback is kept ready.
- **ux-01-first-session-gating** — 'The ad consent flow runs just before the first ad request, not at launch' is looser than Google's consent SDK guidance ('Requesting an update to consent information should be called on every app launch'). It also did not forbid starting the ads SDK or requesting ads before consent. → In the ads flavour the consent status is refreshed silently on every launch, with no UI and no delay to the first frame. The form, when required, is first shown at the first ad-eligible moment after L11, never at first launch. No ads SDK initialisation and no ad request until the consent SDK reports ads can be requested. A 'Privacy options' entry appears in settings when required.
- **ux-03-map-hud** — As written, the map (one winding numbered route with stars under the nodes and the player's marker on the current one) and the HUD (goals / moves / score across the top, booster tray below, pause in a bottom corner) reproduce the genre leader's familiar screens as a whole, with no rule that makes them look like ours. The leader's publisher has sued over look and feel before. Play's Impersonation policy bans in-app elements that imply a link to another app. → The functional order is kept but an own composition is required: a caravan trail with khatam-medallion nodes, a brass-lantern marker, chapter arches and no characters; an arch-shaped header with the moves numeral at its apex, parchment goal tags and a gold bar with khatam marks; pause inside the tray. Added a blurred greyscale side-by-side test with at least 5 people; any screen attributed to another game is recomposed.
- **audio-03-own-voice-callouts** — Short spoken praise by an announcer is the leader's most recognisable sound signature. 'Must not imitate any existing game's voice' was not operational, and there were no rights or cloning safeguards. → Voice direction is fixed to be clearly different: a warm, bright, natural-pitch storyteller delivery, never a deep or pitched-down announcer, with no pitch or formant processing and a short dry sound. A native Arabic recording is required. A written rights release is required, and no clone or imitation of an identifiable performer is allowed. A blind test with 5 listeners is run before shipping. The item stays behind the owner decision and the text banner always accompanies it.
- **monetisation-02-treasure-jar** — Openable at 2500 coins for US$2.99, the jar was a worse deal than the plain pack rate (about 3020 coins for the same money) while presented as treasure and 'savings'. That is misleading value framing. The 'savings' wording also implies the player already owns the coins. → The jar opens only when its content is at least +5% better than the plain pack rate at the player's actual store prices (3200 coins at recommended prices). Content is described as bonus coins on sale, never 'your coins' or savings that can be lost. Reminders are neutral, with no timer and a close button visible at once. The value label is computed from actual prices.
- **monetisation-03-starter-offer** — 'First unaffordable continue' could open an offer pop-up in the middle of a level, against the list's own rule of no proactive offers during a level. The '5x value' claim had no computation rule, and nothing excluded crossed-out prices or pressure wording around the 72-hour window. → At an unaffordable continue it appears only as a card inside the out-of-coins sheet the player opened herself; otherwise as the session-start dialog of the third session. The value line is computed from the contents and actual store prices, or hidden. No crossed-out price, no 'last chance' wording, a plain real remaining-time label, and no extra dialog near the end.
- **monetisation-04-local-offer-tiers** — 'Offer tier selects which pack is featured' could be built as personalised pricing or as targeting players in distress. The rewarded placement 'one free start booster' did not name the reward, which AdMob's rewarded policy requires before each ad. → The tier changes only which pack is highlighted. Everyone sees the same products at the same store prices. It never reads fail counts, lives or closeness of a loss, and never changes prices, grants, spawn rules or seeds. Each rewarded button names its exact reward (the free start booster is beamNova).
- **levels-04-starlit-trail** — The spec and rationale used the word 'saga' for our main levels. The project's trademark notes record it as a registered mark of the leader's publisher, and specs must use only our own vocabulary so the word cannot leak into strings or store text. → Replaced by 'main-route levels' and 'main levels'. No other change.
- **ux-02-comfort-settings** — Same vocabulary problem: 'added to the saga'. → Replaced by 'added to the main route'. No other change.
