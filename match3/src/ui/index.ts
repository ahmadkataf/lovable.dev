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
import { levelById } from './helpers.ts';
import type { ChapterInfo, Screen, Ui, World } from './types.ts';
import { createTitleScreen } from './screens/title.ts';
import { createMapScreen } from './screens/map.ts';
import type { MapScreen, WonInfo } from './screens/map.ts';
import { openIntroDialog } from './dialogs/intro.ts';
import { openLivesDialog } from './dialogs/lives.ts';
import { openShopDialog } from './dialogs/shop.ts';
import { openSettingsDialog } from './dialogs/settings.ts';
import { openDailyDialog } from './dialogs/daily.ts';
import { openUnlockDialog } from './dialogs/unlock.ts';

export type { ChapterInfo, Screen, Ui, World } from './types.ts';
export type { Flags } from './flags.ts';
export { NO_FLAGS, readFlags } from './flags.ts';

export type ScreenKind = 'title' | 'map' | 'play';

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

export function createShell(deps: ShellDeps): Shell {
  const { root, kit, world, flags, services } = deps;
  const { profile, platform, audio, i18n } = services;

  const stage = kit.el('div', { class: 'm-stage' });
  root.appendChild(stage);

  let kind: ScreenKind | null = null;
  let active: Screen | null = null;
  let mapScreen: MapScreen | null = null;
  let play: PlayScreen | null = null;
  let paused = false;
  let lastRoot: boolean | null = null;
  /** What the profile looked like when the current level was started (to tell a first clear from a replay). */
  let lastPlay: { level: number; frontier: number; stars: number } | null = null;
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
    if (flags.gateOff) return true;
    try {
      const fn = profile.featureUnlocked;
      return typeof fn === 'function' ? fn.call(profile, id) === true : true;
    } catch {
      return true;
    }
  }

  function boosterUnlocked(id: BoosterId): boolean {
    if (flags.gateOff) return true;
    try {
      const fn = profile.boosterUnlocked;
      return typeof fn === 'function' ? fn.call(profile, id) === true : true;
    } catch {
      return true;
    }
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
    next.el.classList.add('m-screen');
    if (animate && prev && !kit.reducedMotion()) next.el.classList.add('m-screen--in');
    stage.appendChild(next.el);
    if (prev) {
      try {
        if (prev.dispose) prev.dispose();
      } catch (err) {
        console.error('[shell] screen dispose failed', err);
      }
      prev.el.classList.add('m-screen--out');
      prev.el.setAttribute('aria-hidden', 'true');
      const old = prev.el;
      if (animate && !kit.reducedMotion()) window.setTimeout(() => detach(old), FADE_MS);
      else detach(old);
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
    });
    mapScreen = screen;
    mount(screen, 'map', animate);
    music('menu');
  }

  function goTitle(): void {
    kit.closeAll();
    if (kind === 'title') return;
    showTitle(true);
  }

  function ensurePlay(): PlayScreen {
    if (!play) play = deps.createPlay(ctx);
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
      setPaused: (value: boolean) => p.setPaused(value),
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
      ui.showUnlocks().then(() => {
        introBusy = false;
        if (token !== navToken) return; // the player has moved on meanwhile
        const dialog = openIntroDialog(ui, level);
        introOpen = dialog;
        dialog.closed.then(() => {
          if (introOpen === dialog) introOpen = null;
        });
      });
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
      lastPlay = { level: id, frontier: profile.highestUnlocked(), stars: record ? record.stars : 0 };
      try {
        const p = ensurePlay();
        if (kind === 'play') p.stop();
        else {
          mapScreen = null;
          mount(playHost(p), 'play', true);
        }
        music('level');
        p.start(level, boosters || {});
      } catch (err) {
        console.error('[shell] could not start level ' + id, err);
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
    goTitle,
    syncRoot,

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
        const fn = profile.claimUnlocks;
        const got = typeof fn === 'function' ? fn.call(profile) : [];
        if (Array.isArray(got)) gifts = got;
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
    if (kind === 'title') {
      mount(createTitleScreen(ui), 'title', false);
    } else if (kind === 'map') {
      const ratio = mapScreen ? mapScreen.scrollRatio() : undefined;
      showMap({ scrollRatio: ratio, auto: false }, false);
    }
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
      paused = value;
      if (active && active.setPaused) {
        try {
          active.setPaused(value);
        } catch (err) {
          console.error('[shell] setPaused failed', err);
        }
      } else if (play && kind === 'play') {
        play.setPaused(value);
      }
    },

    current: () => kind,
    syncRoot,
    atRoot,
    goTitle,
  };
}
