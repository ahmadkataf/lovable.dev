/**
 * The application shell: the Navigator (src/app/types.ts) and every screen outside the level —
 * title, journey map, level intro, lives, shop, settings, daily reward, privacy policy, credits.
 *
 *   const kit = watchOverlays(createKit({ … }), () => shell.syncRoot());
 *   const shell = createShell({ root, kit, world, flags, services, createPlay });
 *   platform.setBackHandler(() => shell.handleBack());
 *   shell.start();
 *
 * One screen is mounted at a time inside the stage (cross-faded); dialogs live in the kit's own
 * overlay layer. The shell owns exactly one PlayScreen, created on first use.
 */
import './meta.css';
import type { AppContext, Navigator, PlayScreen } from '../app/types.ts';
import { BRAND } from '../app/brand.ts';
import type { StartBoosters } from '../engine/types.ts';
import type { FeatureId } from '../state/extensions.ts';
import type { BoosterId } from '../state/types.ts';
import type { ConfirmOptions, DialogHandle, DialogOptions, Kit } from './kit/index.ts';
import type { Flags } from './flags.ts';
import { boosterList, levelById } from './helpers.ts';
import { createTickers } from './ticker.ts';
import type { ChapterInfo, Screen, ScreenKind, Ui, World } from './types.ts';
import { createTitleScreen } from './screens/title.ts';
import { createMapScreen } from './screens/map.ts';
import type { MapScreen, WonInfo } from './screens/map.ts';
import { openIntroDialog } from './dialogs/intro.ts';
import { openLivesDialog } from './dialogs/lives.ts';
import { openShopDialog } from './dialogs/shop.ts';
import { openSettingsDialog } from './dialogs/settings.ts';
import { openDailyDialog } from './dialogs/daily.ts';
import { openUnlockDialog } from './dialogs/unlock.ts';

export type { ChapterInfo, Screen, ScreenKind, Ui, World } from './types.ts';
export type { Flags } from './flags.ts';
export { NO_FLAGS, readFlags } from './flags.ts';

export interface ShellDeps {
  /** The app root (#app). */
  root: HTMLElement;
  /** The one kit of the app, wrapped with `watchOverlays` so the shell hears about dialogs. */
  kit: Kit;
  world: World;
  flags: Flags;
  /** Everything of the AppContext except what the shell provides itself. */
  services: Omit<AppContext, 'nav' | 'levels'>;
  /** Creates the play screen (called once, on first use). */
  createPlay(ctx: AppContext): PlayScreen;
}

export interface Shell {
  readonly ctx: AppContext;
  readonly nav: Navigator;
  /** The services screens and dialogs receive (lives / daily dialogs live here). */
  readonly ui: Ui;
  /** Mount the first screen. */
  start(screen?: 'title' | 'map'): void;
  /** Back button; false = at the root, nothing to close. */
  handleBack(): boolean;
  setPaused(paused: boolean): void;
  current(): ScreenKind | null;
  /** Re-evaluate and report whether Back should leave the app. */
  syncRoot(): void;
  /** True when the title screen is showing with nothing open. */
  atRoot(): boolean;
  goTitle(): void;
}

/**
 * Wrap a kit so `onChange` runs whenever a dialog opens or closes — the shell uses it to keep the
 * wrapper's "at root" flag right, whoever opened the dialog (the play screen shares this kit).
 */
export function watchOverlays(kit: Kit, onChange: () => void): Kit {
  const safe = (): void => {
    try {
      onChange();
    } catch {
      // never let bookkeeping break a dialog
    }
  };
  const wrapped: Kit = Object.assign({}, kit, {
    openDialog<T = unknown>(opts: DialogOptions<T>): DialogHandle<T> {
      const dialog = kit.openDialog<T>(opts);
      safe();
      dialog.closed.then(safe, safe);
      return dialog;
    },
    confirm(opts: ConfirmOptions): Promise<boolean> {
      const answer = kit.confirm(opts);
      safe();
      answer.then(safe, safe);
      return answer;
    },
    closeTop(): boolean {
      const consumed = kit.closeTop();
      safe();
      return consumed;
    },
    closeAll(): void {
      kit.closeAll();
      safe();
    },
  });
  return wrapped;
}

const FADE_MS = 240;
/**
 * A screen that has just replaced another takes no pointer input this long, like a new dialog of
 * the kit: the second tap of a double tap on whatever caused the change (Play on the title, Home
 * on the map) must not land on a button of the new screen that happens to sit in the same place.
 */
const ARM_MS = 320;

export function createShell(deps: ShellDeps): Shell {
  const { root, kit, world, flags, services } = deps;
  const { profile, platform, audio, i18n } = services;

  const stage = kit.el('div', { class: 'm-stage' });
  root.appendChild(stage);
  // ?still=1 (screenshots): no endless animation anywhere, in screens and dialogs alike
  if (flags.still) {
    try {
      document.documentElement.classList.add('k-still', 'm-still');
    } catch {
      // no document element: nothing to hold still
    }
  }

  let kind: ScreenKind | null = null;
  let active: Screen | null = null;
  let mapScreen: MapScreen | null = null;
  let play: PlayScreen | null = null;
  let paused = false;
  /** The previous screen while it fades out under the new one. */
  let leaving: { el: HTMLElement; timer: number } | null = null;
  /** The clock of every countdown on the meta screens; stands still while the app is paused. */
  const tickers = createTickers({ set: (fn, ms) => window.setTimeout(fn, ms), clear: (handle) => window.clearTimeout(handle) });
  let lastRoot: boolean | null = null;
  /** What the profile looked like when the current level was started (to tell a first clear from a replay). */
  let lastPlay: { level: number; stars: number } | null = null;
  let dailyOffered = false;

  // one of each dialog at a time
  let introOpen: DialogHandle<unknown> | null = null;
  let introBusy = false;
  /** Changes with every screen change; async continuations compare it to know they are stale. */
  let navToken = 0;
  let shopOpen: Promise<void> | null = null;
  let settingsOpen: Promise<void> | null = null;
  let livesOpen: Promise<void> | null = null;
  let dailyOpen: Promise<void> | null = null;
  let unlocksOpen: Promise<void> | null = null;

  function chapterOf(levelId: number): ChapterInfo {
    const list = world.chapters;
    for (const c of list) if (levelId >= c.from && levelId <= c.to) return c;
    return list[list.length - 1] || { index: 0, theme: 'oasis', nameKey: 'chapter.oasis', from: 1, to: Math.max(1, world.levels.length) };
  }

  function feature(id: FeatureId): boolean {
    return flags.gateOff || profile.featureUnlocked(id) === true;
  }

  function boosterUnlocked(id: BoosterId): boolean {
    return flags.gateOff || profile.boosterUnlocked(id) === true;
  }

  // ───────────────────────────── root flag ─────────────────────────────

  function atRoot(): boolean {
    return kind === 'title' && !kit.hasOverlay();
  }

  function syncRoot(): void {
    const now = atRoot();
    if (now === lastRoot) return;
    lastRoot = now;
    try {
      platform.setAtRoot(now);
    } catch {
      // the wrapper keeps its previous idea
    }
  }

  // ───────────────────────────── screens ─────────────────────────────

  function detach(node: Node): void {
    if (node.parentNode) node.parentNode.removeChild(node);
  }

  function mount(next: Screen, nextKind: ScreenKind, animate: boolean): void {
    const prev = active;
    active = next;
    kind = nextKind;
    navToken++;
    // toasts on the map start below its top bar, so they never cover the counters (meta.css)
    document.documentElement.classList.toggle('m-at-map', nextKind === 'map');
    // (and over the meta screens' dialogs they keep clear of the close button; the play screen's dialogs place their own)
    // (on <body>, under <html dir>, so that meta.css can mirror the rule for Arabic)
    if (document.body) document.body.classList.toggle('m-at-meta', nextKind !== 'play');
    next.el.classList.add('m-screen');
    if (animate && prev && !kit.reducedMotion()) next.el.classList.add('m-screen--in');
    if (animate && prev) {
      const fresh = next.el;
      fresh.classList.add('m-screen--arming');
      window.setTimeout(() => fresh.classList.remove('m-screen--arming'), ARM_MS);
    }
    stage.appendChild(next.el);
    if (prev) {
      try {
        if (prev.dispose) prev.dispose();
      } catch (err) {
        console.error('[shell] screen dispose failed', err);
      }
      prev.el.classList.add('m-screen--out');
      prev.el.setAttribute('aria-hidden', 'true');
      // one screen at most is on its way out: an older one (two changes within the fade) goes at once
      if (leaving) {
        window.clearTimeout(leaving.timer);
        detach(leaving.el);
        leaving = null;
      }
      const old = prev.el;
      if (animate && !kit.reducedMotion()) {
        const entry = {
          el: old,
          timer: window.setTimeout(() => {
            detach(old);
            if (leaving === entry) leaving = null;
          }, FADE_MS),
        };
        leaving = entry;
      } else {
        detach(old);
      }
    }
    if (next.shown) next.shown();
    if (paused && next.setPaused) next.setPaused(true);
    syncRoot();
  }

  function music(track: 'menu' | 'level'): void {
    try {
      audio.music(track);
    } catch {
      // music is a nicety
    }
  }

  function showTitle(animate: boolean): void {
    mapScreen = null;
    mount(createTitleScreen(ui), 'title', animate);
    music('menu');
  }

  function showMap(opts: { focusLevel?: number; won?: WonInfo; scrollRatio?: number; auto: boolean }, animate: boolean): void {
    const screen = createMapScreen(ui, {
      focusLevel: opts.focusLevel,
      won: opts.won,
      scrollRatio: opts.scrollRatio,
      auto: opts.auto,
      offerDaily: opts.auto && !dailyOffered,
      onDailyOffered: () => {
        dailyOffered = true;
      },
      onStale: () => {
        // what the bars offer has changed (a new day switched the daily reward on): same place, rebuilt
        if (kind === 'map' && mapScreen === screen) rebuildMap();
      },
    });
    mapScreen = screen;
    mount(screen, 'map', animate);
    music('menu');
  }

  /** The map again, at the same scroll position (language switched, the bars changed). */
  function rebuildMap(): void {
    const ratio = mapScreen ? mapScreen.scrollRatio() : undefined;
    showMap({ scrollRatio: ratio, auto: false }, false);
  }

  function goTitle(): void {
    kit.closeAll();
    if (kind === 'title') return;
    showTitle(true);
  }

  function ensurePlay(): PlayScreen {
    if (!play) {
      play = deps.createPlay(ctx);
      // created while the app is in the background: it must know, like every screen
      if (paused) play.setPaused(true);
    }
    return play;
  }

  function playHost(p: PlayScreen): Screen {
    const host = kit.el('div', { class: 'm-playhost' });
    host.appendChild(p.el);
    return {
      el: host,
      dispose(): void {
        try {
          p.stop();
        } catch (err) {
          console.error('[shell] play.stop failed', err);
        }
      },
      handleBack: () => p.handleBack(),
      // pause / resume reach the play screen from the shell itself, mounted or not (see setPaused)
    };
  }

  // ───────────────────────────── navigator ─────────────────────────────

  const nav: Navigator = {
    toMap(opts?: { focusLevel?: number; justWon?: number }): void {
      kit.closeAll();
      introOpen = null;
      let won: WonInfo | undefined;
      const justWon = opts && typeof opts.justWon === 'number' ? Math.floor(opts.justWon) : 0;
      if (justWon >= 1 && levelById(world.levels, justWon)) {
        const record = profile.record(justWon);
        const frontier = profile.highestUnlocked();
        const known = lastPlay && lastPlay.level === justWon ? lastPlay : null;
        const isFinal = justWon >= world.levels.length;
        // a first clear moves the frontier (or, on the final level, creates its first record)
        const firstClear = known ? known.stars === 0 && record !== null : record !== null && (isFinal || (frontier === justWon + 1 && profile.record(frontier) === null));
        won = {
          level: justWon,
          stars: record ? record.stars : 0,
          starsBefore: known ? known.stars : 0,
          firstClear,
        };
      }
      lastPlay = null;
      showMap({ focusLevel: opts ? opts.focusLevel : undefined, won, auto: true }, true);
    },

    openLevelIntro(levelId: number): void {
      const id = Math.floor(levelId);
      const level = levelById(world.levels, id);
      if (!level) {
        kit.toast(ui.t('meta.error.level'), { icon: 'info' });
        return;
      }
      if (id > profile.highestUnlocked()) return;
      if (introOpen && introOpen.isOpen()) return;
      // a win celebration is playing on the map: the intro follows it instead of covering it
      if (kind === 'map' && mapScreen && mapScreen.queueIntro(id)) return;
      // a booster may unlock on reaching this level: introduce it first, then show the level
      if (introBusy) return;
      introBusy = true;
      const token = navToken;
      const show = (): void => {
        introBusy = false;
        if (token !== navToken) return; // the player has moved on meanwhile
        if (introOpen && introOpen.isOpen()) return;
        const dialog = openIntroDialog(ui, level);
        introOpen = dialog;
        dialog.closed.then(() => {
          if (introOpen === dialog) introOpen = null;
        });
      };
      let unlocks: Promise<void>;
      try {
        unlocks = ui.showUnlocks();
      } catch (err) {
        // the introduction is a nicety; the level must still open
        console.error('[shell] booster introduction failed', err);
        unlocks = Promise.resolve();
      }
      unlocks.then(show, show);
    },

    toPlay(levelId: number, boosters: StartBoosters): void {
      const id = Math.floor(levelId);
      const level = levelById(world.levels, id);
      if (!level) {
        kit.toast(ui.t('meta.error.level'), { icon: 'info' });
        return;
      }
      kit.closeAll();
      introOpen = null;
      const record = profile.record(id);
      lastPlay = { level: id, stars: record ? record.stars : 0 };
      try {
        const p = ensurePlay();
        if (kind === 'play') p.stop();
        else {
          mapScreen = null;
          mount(playHost(p), 'play', true);
        }
        // A level started while the app is in the background waits for the resume. (Said again
        // here because stopping the screen may have made it forget its own "paused".)
        if (paused) p.setPaused(true);
        music('level');
        p.start(level, boosters || {});
      } catch (err) {
        console.error('[shell] could not start level ' + id, err);
        lastPlay = null;
        kit.toast(ui.t('meta.error.level'), { icon: 'info' });
        showMap({ focusLevel: id, auto: false }, true);
      }
      syncRoot();
    },

    openShop(): Promise<void> {
      if (!shopOpen) {
        shopOpen = openShopDialog(ui).then(
          () => {
            shopOpen = null;
          },
          () => {
            shopOpen = null;
          },
        );
      }
      return shopOpen;
    },

    openSettings(): Promise<void> {
      if (!settingsOpen) {
        settingsOpen = openSettingsDialog(ui).then(
          () => {
            settingsOpen = null;
          },
          () => {
            settingsOpen = null;
          },
        );
      }
      return settingsOpen;
    },
  };

  const ctx: AppContext = {
    art: services.art,
    audio: services.audio,
    i18n: services.i18n,
    platform: services.platform,
    profile: services.profile,
    store: services.store,
    levels: world.levels,
    nav,
  };

  const ui: Ui = {
    ctx,
    kit,
    world,
    flags,
    t: (key, vars) => i18n.t(key, vars),
    feature,
    boosterUnlocked,
    chapterOf,
    screen: () => kind,
    ticker: (tick) => tickers.add(tick),
    goTitle,
    syncRoot,

    startLevel(levelId: number, paid: StartBoosters, free: StartBoosters): boolean {
      // the boosters the player chose leave the inventory only for a level that really starts
      const taken = boosterList(paid).filter((id) => profile.takeBooster(id));
      const all: StartBoosters = {};
      for (const id of taken) all[id] = true;
      for (const id of boosterList(free)) all[id] = true;
      nav.toPlay(levelId, all);
      if (kind === 'play') return true;
      for (const id of taken) profile.addBooster(id, 1);
      return false;
    },

    openLives(): Promise<void> {
      if (!livesOpen) {
        const done = (): void => {
          livesOpen = null;
        };
        livesOpen = openLivesDialog(ui).then(done, done);
      }
      return livesOpen;
    },

    openDaily(): Promise<void> {
      if (!dailyOpen) {
        const done = (): void => {
          dailyOpen = null;
        };
        dailyOpen = openDailyDialog(ui).then(done, done);
      }
      return dailyOpen;
    },

    showUnlocks(): Promise<void> {
      if (unlocksOpen) return unlocksOpen;
      let gifts: { id: BoosterId; amount: number }[] = [];
      try {
        gifts = profile.claimUnlocks();
      } catch (err) {
        console.error('[shell] claimUnlocks failed', err);
      }
      if (gifts.length === 0) return Promise.resolve();
      const done = (): void => {
        unlocksOpen = null;
      };
      unlocksOpen = openUnlockDialog(ui, gifts).then(done, done);
      return unlocksOpen;
    },
  };

  // ───────────────────────────── language ─────────────────────────────

  function setDocTitle(): void {
    try {
      document.title = BRAND.name[i18n.lang()];
    } catch {
      // no document title to set
    }
  }

  i18n.onChange(() => {
    setDocTitle();
    // rebuild the visible screen in the new language and direction; dialogs re-render themselves
    if (kind === 'title') mount(createTitleScreen(ui), 'title', false);
    else if (kind === 'map') rebuildMap();
  });

  setDocTitle();

  return {
    ctx,
    nav,
    ui,

    start(screen?: 'title' | 'map'): void {
      if (screen === 'map') showMap({ auto: true }, false);
      else showTitle(false);
    },

    handleBack(): boolean {
      if (kit.closeTop()) return true;
      if (active && active.handleBack) {
        try {
          if (active.handleBack()) return true;
        } catch (err) {
          console.error('[shell] back handler failed', err);
        }
      }
      if (kind === 'play') {
        nav.toMap();
        return true;
      }
      if (kind === 'map') {
        goTitle();
        return true;
      }
      return false;
    },

    setPaused(value: boolean): void {
      if (value === paused) return;
      paused = value;
      tickers.setPaused(value);
      // The play screen always hears it, mounted or not: it keeps its own "app is paused" freeze,
      // and a level may be left while the app is in the background (an ad's result can arrive
      // before the resume) — a resume it never heard of would leave every later level frozen.
      if (play) {
        try {
          play.setPaused(value);
        } catch (err) {
          console.error('[shell] play.setPaused failed', err);
        }
      }
      if (active && active.setPaused) {
        try {
          active.setPaused(value);
        } catch (err) {
          console.error('[shell] setPaused failed', err);
        }
      }
    },

    current: () => kind,
    syncRoot,
    atRoot,
    goTitle,
  };
}
