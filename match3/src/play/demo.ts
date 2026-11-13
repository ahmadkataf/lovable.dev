/**
 * Dev-only harness of the play screen (play-demo.html). Not imported by the game.
 *
 * It builds a real AppContext — art, audio, i18n, platform, profile — with a stub Navigator (a
 * plain list of levels standing in for the map) and a stub store whose rewarded videos can be
 * switched on from the URL. Query parameters are documented in play-demo.html.
 * Everything a test needs is on `window.__demo`; the play screen's own hooks are on `window.__play`.
 */
import type { AppContext, Navigator, PlayScreen } from '../app/types.ts';
import { createArt } from '../art/index.ts';
import { createAudio } from '../audio/index.ts';
import { validateLevel } from '../engine/index.ts';
import type { LevelDef, StartBoosters } from '../engine/types.ts';
import { createI18n } from '../i18n/index.ts';
import { LEVELS } from '../levels/index.ts';
import type { AdPlacement, RewardedOutcome, StoreApi } from '../monetize/types.ts';
import { SAVE_KEY, createPlatform } from '../platform/index.ts';
import { createProfile } from '../state/index.ts';
import type { BoosterId } from '../state/types.ts';
import { createKit, fontsReady } from '../ui/kit/index.ts';
import { createPlayScreen } from './index.ts';
import { TIP_IDS, tipSeenKey } from './tutorial.ts';

const q = new URLSearchParams(location.search);
const lang = q.get('lang') === 'ar' ? 'ar' : 'en';

// ───────────────────────────── harness levels (every mechanic) ─────────────────────────────

const HARNESS: Record<string, LevelDef> = {
  /** every blocker at once: sand ×1 / ×2, stones 1–3, chains, vines, lamps, holes, pre-placed specials */
  mix: {
    id: 901,
    cols: 9,
    rows: 9,
    colors: 5,
    moves: 30,
    pieces: ['_...L..._', '.H.....V.', '..c...c..', '.1.2.3.1.', '...N.P...', 'v.......v', '..c...c..', '.........', '_......._'],
    floor: ['000000000', '000000000', '000000000', '000000000', '000000000', '000000000', '011111110', '122222221', '012222210'],
    goals: [{ kind: 'sand' }, { kind: 'lamp', target: 2 }, { kind: 'stone' }],
    stars: [4000, 8000, 12000],
    lamps: { total: 2, maxOnBoard: 1, everyMoves: 3 },
  },
  /** won in a handful of moves */
  easy: {
    id: 902,
    cols: 7,
    rows: 7,
    colors: 4,
    moves: 24,
    pieces: ['.......', '.......', '.......', '.......', '.......', '.......', '.......'],
    goals: [{ kind: 'color', color: 0, target: 9 }],
    stars: [1500, 5000, 9000],
  },
  /** cannot be won: three moves for ninety-nine gems */
  hard: {
    id: 903,
    cols: 7,
    rows: 7,
    colors: 5,
    moves: 3,
    pieces: ['.......', '.......', '.......', '.......', '.......', '.......', '.......'],
    goals: [
      { kind: 'color', color: 1, target: 99 },
      { kind: 'color', color: 3, target: 60 },
    ],
    stars: [20000, 40000, 60000],
  },
  /** specials ready to fire (hammer them) */
  fx: {
    id: 904,
    cols: 8,
    rows: 8,
    colors: 5,
    moves: 20,
    pieces: ['........', '........', '..H.....', '........', '.....N..', '........', '.V....P.', '........'],
    goals: [{ kind: 'score', target: 3000 }],
    stars: [3000, 6000, 9000],
  },
  /** special + special pairs side by side */
  combo: {
    id: 905,
    cols: 8,
    rows: 8,
    colors: 5,
    moves: 20,
    pieces: ['........', '.HN.....', '........', '....PP..', '........', '.NN...HV', '........', '...PH...'],
    goals: [{ kind: 'score', target: 3000 }],
    stars: [3000, 9000, 15000],
  },
  lamp: {
    id: 906,
    cols: 7,
    rows: 8,
    colors: 4,
    moves: 25,
    pieces: ['.L...L.', '.......', '.......', '.......', '.......', '.......', '.......', '.......'],
    goals: [{ kind: 'lamp', target: 3 }],
    stars: [2000, 5000, 8000],
    lamps: { total: 3, maxOnBoard: 2, everyMoves: 2 },
  },
  vine: {
    id: 907,
    cols: 8,
    rows: 8,
    colors: 5,
    moves: 25,
    pieces: ['........', '........', '..vv....', '..vv....', '....c1..', '....2c..', '........', '........'],
    goals: [{ kind: 'vine' }, { kind: 'chain' }],
    stars: [2000, 5000, 8000],
  },
  /** an irregular board: holes in the middle and stepped edges */
  holes: {
    id: 908,
    cols: 9,
    rows: 9,
    colors: 5,
    moves: 25,
    pieces: ['__.....__', '_......._', '.........', '...._....', '..._._...', '...._....', '.........', '_......._', '__.....__'],
    floor: ['000000000', '000000000', '001111100', '001101100', '001000100', '001101100', '001111100', '000000000', '000000000'],
    goals: [{ kind: 'sand' }, { kind: 'score', target: 4000 }],
    stars: [4000, 8000, 12000],
  },
  /** the smallest board the screen must lay out */
  tiny: {
    id: 909,
    cols: 5,
    rows: 5,
    colors: 4,
    moves: 15,
    pieces: ['.....', '.....', '.....', '.....', '.....'],
    goals: [{ kind: 'score', target: 1200 }],
    stars: [1200, 2400, 3600],
  },
  /** four goals at once (the header's widest case) */
  goals4: {
    id: 910,
    cols: 9,
    rows: 9,
    colors: 6,
    moves: 35,
    pieces: ['.........', '.........', '..1...1..', '...c.c...', '....v....', '...c.c...', '..1...1..', '.........', '.........'],
    floor: ['000000000', '000000000', '000000000', '000000000', '000000000', '000000000', '000000000', '111111111', '222222222'],
    goals: [{ kind: 'color', color: 5, target: 24 }, { kind: 'sand' }, { kind: 'stone' }, { kind: 'chain' }],
    stars: [6000, 12000, 18000],
  },
};

for (const name of Object.keys(HARNESS)) {
  const problems = validateLevel(HARNESS[name] as LevelDef);
  if (problems.length > 0) console.error('[demo] harness level "' + name + '" is invalid: ' + problems.join('; '));
}

function findLevel(key: string | null): LevelDef {
  if (key && HARNESS[key]) return HARNESS[key] as LevelDef;
  const id = Number(key);
  if (key && isFinite(id)) {
    const byId = LEVELS.find((l) => l.id === id);
    if (byId) return byId;
    for (const name of Object.keys(HARNESS)) if ((HARNESS[name] as LevelDef).id === id) return HARNESS[name] as LevelDef;
  }
  return HARNESS.mix as LevelDef;
}

// ───────────────────────────── services ─────────────────────────────

if (q.get('keep') !== '1') {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // no storage: nothing to clear
  }
}

const art = createArt();
const audio = createAudio();
const i18n = createI18n(lang);
const platform = createPlatform();
const kit = createKit({ art, audio, i18n, platform });
const allLevels: LevelDef[] = LEVELS.slice();

const profile = createProfile({
  load: () => platform.loadSave(),
  save: (json) => platform.storeSave(json),
  now: () => Date.now(),
  levelCount: Math.max(allLevels.length, 120),
});

if (q.get('mute') === '1') {
  audio.setSfxEnabled(false);
  audio.setMusicEnabled(false);
} else {
  audio.setSfxEnabled(profile.settings().sfx);
  audio.setMusicEnabled(profile.settings().music);
}

const coins = q.get('coins');
if (coins !== null && isFinite(Number(coins))) {
  const want = Math.max(0, Math.floor(Number(coins)));
  const have = profile.coins();
  if (want > have) profile.addCoins(want - have);
  else if (want < have) profile.spendCoins(have - want);
}
const lives = q.get('lives');
if (lives !== null && isFinite(Number(lives))) {
  const want = Math.max(0, Math.floor(Number(lives)));
  while (profile.lives().count > want && profile.loseLife()) {
    // drain down to the requested number
  }
}
const inv = q.get('inv');
if (inv !== null && isFinite(Number(inv))) {
  const want = Math.max(0, Math.floor(Number(inv)));
  for (const id of ['hammer', 'freeSwap', 'shuffle'] as BoosterId[]) {
    const have = profile.boosterCount(id);
    if (want > have) profile.addBooster(id, want - have);
    else for (let i = have; i > want; i--) profile.takeBooster(id);
  }
}

const tut = q.get('tut');
if (tut === '0') for (const id of TIP_IDS) profile.markSeen(tipSeenKey(id));

// ───────────────────────────── stub store ─────────────────────────────

const adsMode = q.get('ads');
const log: { nav: string[]; ads: string[]; interstitials: number } = { nav: [], ads: [], interstitials: 0 };

const store: StoreApi = {
  iapAvailable: () => false,
  products: () => [],
  buy: () => Promise.resolve('unavailable'),
  restore: () => Promise.resolve(0),
  owns: () => false,
  adsAvailable: () => adsMode !== null,
  rewardedReady: () => adsMode !== null,
  freeCoinAdsLeft: () => 0,
  showRewarded: (placement: AdPlacement) =>
    new Promise<RewardedOutcome>((resolve) => {
      log.ads.push(placement);
      window.setTimeout(() => resolve(adsMode === '1' ? 'earned' : 'dismissed'), 250);
    }),
  maybeShowInterstitial: () => {
    log.interstitials++;
    return Promise.resolve(false);
  },
  privacyOptionsRequired: () => false,
  showPrivacyOptions: () => Promise.resolve(),
  onChange: () => () => undefined,
};

// ───────────────────────────── stub navigator ─────────────────────────────

const app = document.getElementById('app') as HTMLElement;
const map = document.createElement('div');
map.id = 'map';
document.body.appendChild(map);

let play: PlayScreen | null = null;
let mounted = false;

function startBoosters(): StartBoosters {
  const out: StartBoosters = {};
  const list = (q.get('boosters') || '').split(',');
  if (list.indexOf('extraMoves') >= 0) out.extraMoves = true;
  if (list.indexOf('prism') >= 0) out.prism = true;
  if (list.indexOf('beamNova') >= 0) out.beamNova = true;
  return out;
}

function withTutorial(level: LevelDef): LevelDef {
  if (tut && tut !== '0') return { ...level, tutorial: tut };
  return level;
}

function showMap(note: string): void {
  if (play) play.stop();
  if (play && mounted) {
    app.removeChild(play.el);
    mounted = false;
  }
  map.style.display = 'block';
  map.textContent = '';
  const head = document.createElement('p');
  head.textContent = 'Harness map — ' + note;
  map.appendChild(head);
  const add = (label: string, level: LevelDef): void => {
    const b = document.createElement('button');
    b.textContent = label;
    b.dataset.level = String(level.id);
    b.addEventListener('click', () => nav.toPlay(level.id, {}));
    map.appendChild(b);
  };
  for (const name of Object.keys(HARNESS)) add(name, HARNESS[name] as LevelDef);
  for (const level of allLevels.slice(0, 12)) add('L' + level.id, level);
  const pre = document.createElement('pre');
  pre.textContent = 'coins ' + profile.coins() + ' · lives ' + profile.lives().count + '\n' + log.nav.join('\n');
  map.appendChild(pre);
}

const nav: Navigator = {
  toMap(opts) {
    log.nav.push('toMap ' + JSON.stringify(opts || {}));
    showMap(JSON.stringify(opts || {}));
  },
  openLevelIntro(levelId) {
    log.nav.push('openLevelIntro ' + levelId);
  },
  toPlay(levelId, boosters) {
    log.nav.push('toPlay ' + levelId);
    startLevel(findLevel(String(levelId)), boosters);
  },
  openShop() {
    log.nav.push('openShop');
    // the shop stand-in: a dialog that hands out coins
    return kit
      .openDialog<string>({
        title: 'Shop (harness)',
        body: 'Coins: ' + profile.coins(),
        buttons: [
          { label: '+5000', result: 'coins', onClick: () => profile.addCoins(5000) },
          { label: 'Close', result: 'close' },
        ],
      })
      .closed.then(() => undefined);
  },
  openSettings() {
    log.nav.push('openSettings');
    return Promise.resolve();
  },
};

const ctx: AppContext = { art, audio, i18n, platform, profile, store, levels: allLevels, nav };

function startLevel(level: LevelDef, boosters: StartBoosters): void {
  if (!play) play = createPlayScreen(ctx, { kit });
  map.style.display = 'none';
  if (!mounted) {
    app.appendChild(play.el);
    mounted = true;
  }
  play.start(withTutorial(level), boosters);
}

platform.setBackHandler(() => (play ? play.handleBack() : false) || kit.closeTop());
platform.onPause(() => {
  audio.suspend();
  if (play) play.setPaused(true);
});
platform.onResume(() => {
  audio.resume();
  if (play) play.setPaused(false);
});

const demo = {
  ctx,
  log,
  profile,
  kit,
  levels: HARNESS,
  /** Start a level by id or harness name. */
  start: (key: string, boosters?: StartBoosters) => startLevel(findLevel(key), boosters || {}),
  stop: () => {
    if (play) play.stop();
  },
  back: () => (play ? play.handleBack() : false),
  pause: (on: boolean) => {
    if (play) play.setPaused(on);
  },
  save: () => {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') as unknown;
    } catch {
      return null;
    }
  },
  ready: false,
};
(window as unknown as { __demo: typeof demo }).__demo = demo;

void fontsReady().then(() => {
  if (q.get('level') !== 'none') startLevel(findLevel(q.get('level')), startBoosters());
  else showMap('pick a level');
  demo.ready = true;
});
