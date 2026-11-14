/**
 * Entry point: builds the services (platform → profile → i18n → art, audio, kit, store), wires the
 * app-wide behaviour (audio unlock, pause / resume, Back, safe-area insets, the global error net)
 * and mounts the shell. docs/DESIGN.md §1.
 *
 * Debug hooks exist only under the dev server or with `?debug=1` (see src/ui/flags.ts):
 * `window.__app = { ctx, goto(screen, arg), profile, kit, shell, store, flags }`.
 */
import type { AppContext, PlayScreen } from './app/types.ts';
import { createArt } from './art/index.ts';
import { createAudio } from './audio/index.ts';
import { createI18n, resolveLang } from './i18n/index.ts';
import { CHAPTERS, LEVELS } from './levels/index.ts';
import { createStore } from './monetize/index.ts';
import { createPlatform } from './platform/index.ts';
import type { PlatformApi } from './platform/types.ts';
import { createPlayScreen } from './play/index.ts';
import { createProfile } from './state/index.ts';
import type { BoosterId } from './state/types.ts';
import { createKit, fontsReady } from './ui/kit/index.ts';
import type { Kit } from './ui/kit/index.ts';
import { createShell, readFlags, watchOverlays } from './ui/index.ts';
import type { Flags, Shell, World } from './ui/index.ts';

interface BootWindow {
  /** Set as soon as this module runs: the compatibility guard in index.html watches it. */
  __bootStarted?: boolean;
  /** Set when the first screen is up. */
  __booted?: boolean;
  /** Provided by the guard in index.html: shows the "please update" message inside #boot. */
  __bootFail?: () => void;
  __app?: unknown;
}

const bootWindow = window as unknown as BootWindow;
bootWindow.__bootStarted = true;

/** How long the first paint may wait for the bundled font. */
const FONT_WAIT_MS = 2500;
/** Minimum time between two "something went wrong" toasts. */
const ERROR_TOAST_GAP_MS = 8000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getFlags(): Flags {
  let search = '';
  try {
    search = window.location.search;
  } catch {
    search = '';
  }
  return readFlags(search, import.meta.env.DEV === true, (s) => window.atob(s));
}

/** Wrapper extras that are not part of the platform contract. */
interface WrapperExtras {
  insets?: () => string;
  ready?: () => void;
}

function wrapperExtras(): WrapperExtras | null {
  try {
    const bridge = window.AndroidBridge as unknown as WrapperExtras | undefined;
    return typeof bridge === 'object' && bridge !== null ? bridge : null;
  } catch {
    return null;
  }
}

async function boot(): Promise<void> {
  const flags = getFlags();

  // ── platform & profile ──
  const device = createPlatform();
  const world: World = flags.mockLevels > 0 ? (await import('./ui/dev/mock.ts')).mockWorld(flags.mockLevels) : { levels: LEVELS, chapters: CHAPTERS };

  let memorySave: string | null = flags.save;
  const profile = createProfile({
    // ?save=… (debug): start from the given save and never touch the real one
    load: () => (flags.save !== null ? memorySave : device.loadSave()),
    save: (json) => {
      if (flags.save !== null) memorySave = json;
      else device.storeSave(json);
    },
    now: () => Date.now(),
    levelCount: world.levels.length,
    // a hard level's first clear pays double (docs/DESIGN.md §5)
    isHardLevel: (levelId: number) => {
      const level = world.levels[levelId - 1];
      return !!level && level.id === levelId && level.hard === true;
    },
  });

  // tester mode (the owner's tester APK, `?debug=1&tester=1`): a large balance at every start
  if (flags.tester) (await import('./ui/dev/tester.ts')).topUpTester(profile);

  // the same platform, with haptics following the player's setting
  const platform: PlatformApi = {
    info: () => device.info(),
    loadSave: () => device.loadSave(),
    storeSave: (json) => device.storeSave(json),
    haptic: (kind) => {
      if (profile.settings().haptics) device.haptic(kind);
    },
    setBackHandler: (handler) => device.setBackHandler(handler),
    setAtRoot: (atRoot) => device.setAtRoot(atRoot),
    rateApp: () => device.rateApp(),
    onPause: (listener) => device.onPause(listener),
    onResume: (listener) => device.onResume(listener),
  };

  // ── language: the saved choice, else the device language ──
  const i18n = createI18n(flags.lang || resolveLang(profile.settings().lang, platform.info().locale));

  // ── art, audio, kit, store ──
  const art = createArt();
  const audio = createAudio();
  const root = document.getElementById('app') || document.body.appendChild(document.createElement('div'));

  let shell: Shell | null = null;
  const kit: Kit = watchOverlays(createKit({ art, audio, i18n, platform, root }), () => {
    if (shell) shell.syncRoot();
  });

  // Purchases and ads: the Android wrapper's store, the test store in a browser (`?fakestore=1`,
  // or under the dev server), otherwise nothing is on offer.
  const store = createStore({ profile, platform, now: () => Date.now() });

  // ── sound settings: now and whenever they change ──
  let sfxOn: boolean | null = null;
  let musicOn: boolean | null = null;
  function applySoundSettings(): void {
    const settings = profile.settings();
    if (settings.sfx !== sfxOn) {
      sfxOn = settings.sfx;
      audio.setSfxEnabled(sfxOn);
    }
    if (settings.music !== musicOn) {
      musicOn = settings.music;
      audio.setMusicEnabled(musicOn);
    }
  }
  applySoundSettings();
  profile.subscribe(applySoundSettings);

  // ── the first gesture unlocks audio ──
  const gestures = ['pointerdown', 'pointerup', 'keydown', 'touchend'] as const;
  function onGesture(ev: Event): void {
    try {
      audio.unlock();
    } catch {
      // stays locked until the next gesture
    }
    // pointerdown alone does not always count as a user activation: keep listening until a full tap or key
    if (ev.type !== 'pointerdown') for (const type of gestures) window.removeEventListener(type, onGesture, true);
  }
  for (const type of gestures) window.addEventListener(type, onGesture, true);

  // ── safe-area insets from the Android wrapper ──
  function applyInsets(value: unknown): void {
    try {
      const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
      if (typeof parsed !== 'object' || parsed === null) return;
      const o = parsed as Record<string, unknown>;
      const px = (v: unknown): number | undefined => (typeof v === 'number' && isFinite(v) ? Math.max(0, v) : undefined);
      if (typeof kit.setSafeInsets === 'function') kit.setSafeInsets({ top: px(o['top']), right: px(o['right']), bottom: px(o['bottom']), left: px(o['left']) });
    } catch {
      // unreadable insets: keep the current ones
    }
  }
  const extras = wrapperExtras();
  if (extras && typeof extras.insets === 'function') {
    try {
      applyInsets(extras.insets());
    } catch {
      // the kit defaults (env(safe-area-inset-*)) stay
    }
  }
  try {
    const holder = window as unknown as { __native?: Record<string, unknown> };
    if (typeof holder.__native !== 'object' || holder.__native === null) holder.__native = {};
    holder.__native['insets'] = applyInsets;
  } catch {
    // no hook object: insets stay as read at start
  }

  // ── global safety net: log, and one friendly toast instead of a broken screen ──
  let lastErrorToast = 0;
  function reportProblem(what: unknown): void {
    const text = what instanceof Error ? what.message : String(what);
    if (text.indexOf('ResizeObserver loop') >= 0) return; // a browser notice, not a fault
    console.error('[app] unexpected error', what);
    const now = Date.now();
    if (now - lastErrorToast < ERROR_TOAST_GAP_MS) return;
    lastErrorToast = now;
    try {
      kit.toast(i18n.t('meta.error.generic'), { icon: 'info' });
    } catch {
      // nothing more we can do
    }
  }
  window.addEventListener('error', (ev: ErrorEvent) => reportProblem(ev.error || ev.message));
  window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => reportProblem(ev.reason));

  // ── shell ──
  const createPlay = createPlayScreen as unknown as (ctx: AppContext, opts: { kit: Kit }) => PlayScreen;
  shell = createShell({
    root,
    kit,
    world,
    flags,
    services: { art, audio, i18n, platform, profile, store },
    createPlay: (ctx) => createPlay(ctx, { kit }),
  });
  const app = shell;

  platform.setBackHandler(() => app.handleBack());
  platform.onPause(() => {
    try {
      audio.suspend();
    } finally {
      app.setPaused(true);
    }
  });
  platform.onResume(() => {
    try {
      audio.resume();
    } finally {
      app.setPaused(false);
    }
  });

  // ── first paint: wait for the font (briefly), mount, drop the boot cover ──
  await Promise.race([fontsReady(), wait(FONT_WAIT_MS)]);
  app.start(flags.screen || 'title');
  app.syncRoot();
  bootWindow.__booted = true;
  const cover = document.getElementById('boot');
  if (cover && cover.parentNode) cover.parentNode.removeChild(cover);
  // splash hand-off once the first frame is on screen
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      try {
        if (extras && typeof extras.ready === 'function') extras.ready();
      } catch {
        // the wrapper drops its splash by itself after a timeout
      }
    });
  });

  if (flags.debug) {
    bootWindow.__app = {
      ctx: app.ctx,
      profile,
      kit,
      shell: app,
      store,
      flags,
      world,
      goto(screen: string, arg?: unknown): void {
        const nav = app.ctx.nav;
        if (screen === 'title') app.goTitle();
        else if (screen === 'map') nav.toMap(typeof arg === 'object' && arg !== null ? (arg as { focusLevel?: number; justWon?: number }) : undefined);
        else if (screen === 'play') nav.toPlay(typeof arg === 'number' ? arg : 1, {});
        else if (screen === 'intro') nav.openLevelIntro(typeof arg === 'number' ? arg : profile.highestUnlocked());
        else if (screen === 'shop') void nav.openShop();
        else if (screen === 'settings') void nav.openSettings();
        else if (screen === 'lives') void app.ui.openLives();
        else if (screen === 'daily') void app.ui.openDaily();
        else if (screen === 'unlock') {
          const id = (typeof arg === 'string' ? arg : 'hammer') as BoosterId;
          void import('./ui/dialogs/unlock.ts').then((m) => m.openUnlockDialog(app.ui, [{ id, amount: 3 }]));
        }
      },
    };
  }
}

boot().catch((err: unknown) => {
  console.error('[app] boot failed', err);
  try {
    if (!bootWindow.__booted && typeof bootWindow.__bootFail === 'function') bootWindow.__bootFail();
  } catch {
    // the guard's own timer will show the message
  }
});
