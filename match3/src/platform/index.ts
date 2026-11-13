/**
 * Platform bridge: the one module that knows where the game runs.
 *  - Inside the Android wrapper (`window.AndroidBridge` exists): saves, haptics, Back and lifecycle
 *    go through the native bridge. Every bridge call is guarded — a failing bridge never reaches the game.
 *  - Anywhere else (dev server, tests, screenshots): localStorage, navigator.vibrate, the Escape key
 *    as Back and the Page Visibility API.
 *
 * Nothing here touches `window` at import time, so the module loads under Node as well; there
 * `createPlatform()` returns a harmless in-memory implementation.
 */
import type { AndroidBridge, AppInfo, HapticKind, NativeHooks, PlatformApi } from './types.ts';
import { APP_VERSION_CODE, APP_VERSION_NAME } from './version.ts';

export { APP_VERSION_CODE, APP_VERSION_NAME };

/** The single localStorage key the game uses. */
export const SAVE_KEY = 'match3.save.v1';

const DEFAULT_LOCALE = 'en-US';

// ───────────────────────────── small pure helpers ─────────────────────────────

/**
 * A clean BCP-47-looking tag from whatever the device reports ("ar_SY" → "ar-SY"), or null when the
 * value is not a language tag at all.
 */
export function normalizeLocale(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const tag = value.trim().replace(/_/g, '-');
  return /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8})*$/.test(tag) ? tag : null;
}

/**
 * Parse the wrapper's `info()` JSON defensively: any missing or malformed field falls back to the
 * web build's own value, so a broken bridge still yields a complete AppInfo.
 */
export function parseAndroidInfo(raw: unknown, fallbackLocale: string): AppInfo {
  const info: AppInfo = {
    versionName: APP_VERSION_NAME,
    versionCode: APP_VERSION_CODE,
    locale: normalizeLocale(fallbackLocale) || DEFAULT_LOCALE,
    platform: 'android',
  };
  let parsed: unknown = null;
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return info;
  const o = parsed as Record<string, unknown>;
  if (typeof o.versionName === 'string' && o.versionName.length > 0 && o.versionName.length <= 64) {
    info.versionName = o.versionName;
  }
  const code = typeof o.versionCode === 'string' ? Number(o.versionCode) : o.versionCode;
  if (typeof code === 'number' && isFinite(code) && code >= 0) info.versionCode = Math.floor(code);
  const locale = normalizeLocale(o.locale);
  if (locale) info.locale = locale;
  return info;
}

/** navigator.vibrate patterns (ms) for the browser fallback. */
const VIBRATION: Record<HapticKind, number | number[]> = {
  light: 8,
  medium: 16,
  heavy: 30,
  success: [12, 50, 20],
  error: [30, 50, 30],
};

function call(fn: () => void): void {
  try {
    fn();
  } catch (err) {
    if (typeof console !== 'undefined') console.error('[platform] listener failed', err);
  }
}

// ───────────────────────────── shared pieces ─────────────────────────────

interface Lifecycle {
  onPause(listener: () => void): void;
  onResume(listener: () => void): void;
  /** Idempotent: listeners fire only when the state really changes. */
  setPaused(paused: boolean): void;
}

/**
 * Pause / resume with de-duplication, because two sources can report the same transition
 * (the wrapper's hooks and the page's visibility) in either order.
 */
function createLifecycle(initiallyPaused: boolean): Lifecycle {
  const pauseListeners: (() => void)[] = [];
  const resumeListeners: (() => void)[] = [];
  let paused = initiallyPaused;
  return {
    onPause(listener) {
      pauseListeners.push(listener);
    },
    onResume(listener) {
      resumeListeners.push(listener);
    },
    setPaused(next) {
      if (next === paused) return;
      paused = next;
      for (const listener of (next ? pauseListeners : resumeListeners).slice()) call(listener);
    },
  };
}

function isHidden(doc: Document | undefined): boolean {
  try {
    return !!doc && (doc.hidden === true || doc.visibilityState === 'hidden');
  } catch {
    return false;
  }
}

function watchVisibility(doc: Document | undefined, lifecycle: Lifecycle): void {
  try {
    if (!doc || typeof doc.addEventListener !== 'function') return;
    doc.addEventListener('visibilitychange', () => lifecycle.setPaused(isHidden(doc)));
  } catch {
    // no usable document: lifecycle then relies on the native hooks alone
  }
}

function deviceLocale(win: Window | undefined): string {
  try {
    const nav = win ? win.navigator : undefined;
    if (!nav) return DEFAULT_LOCALE;
    return normalizeLocale(nav.language) || normalizeLocale(nav.languages && nav.languages[0]) || DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** localStorage with every access guarded (it can be missing, disabled, full, or throw on touch). */
interface SafeStorage {
  read(): string | null;
  /** Returns false when the value could not be written. */
  write(value: string): boolean;
}

function localSave(win: Window | undefined): SafeStorage {
  const area = (): Storage | null => {
    try {
      return (win && win.localStorage) || null;
    } catch {
      return null;
    }
  };
  return {
    read() {
      try {
        const store = area();
        const value = store ? store.getItem(SAVE_KEY) : null;
        return typeof value === 'string' && value.length > 0 ? value : null;
      } catch {
        return null;
      }
    },
    write(value) {
      try {
        const store = area();
        if (!store) return false;
        store.setItem(SAVE_KEY, value);
        return true;
      } catch {
        return false;
      }
    },
  };
}

// ───────────────────────────── Android ─────────────────────────────

function createAndroid(win: Window, bridge: AndroidBridge): PlatformApi {
  const lifecycle = createLifecycle(false);
  const backup = localSave(win);
  let backHandler: (() => boolean) | null = null;
  let cachedInfo: AppInfo | null = null;

  // Hooks the wrapper calls. Merge into an existing object so hooks registered by other modules
  // (e.g. the store) survive, whichever module starts first.
  try {
    const hooks: NativeHooks = win.__native || ({} as NativeHooks);
    hooks.back = () => {
      const handler = backHandler;
      if (handler) call(() => void handler());
    };
    hooks.pause = () => lifecycle.setPaused(true);
    hooks.resume = () => lifecycle.setPaused(false);
    win.__native = hooks;
  } catch {
    // a frozen window object: nothing more we can do
  }
  // The WebView also reports visibility; together with the hooks, whichever arrives first wins.
  watchVisibility(win.document, lifecycle);

  return {
    info(): AppInfo {
      if (cachedInfo) return cachedInfo;
      let raw: unknown = null;
      let ok = false;
      try {
        raw = bridge.info();
        ok = true;
      } catch {
        raw = null;
      }
      const info = parseAndroidInfo(raw, deviceLocale(win));
      if (ok) cachedInfo = info; // retry next time only if the call itself failed
      return info;
    },

    loadSave(): string | null {
      let native: unknown = null;
      try {
        native = bridge.loadSave();
      } catch {
        native = null;
      }
      if (typeof native === 'string' && native.length > 0) return native;
      // Nothing from the wrapper (first run, or a failing bridge): fall back to the mirror copy.
      return backup.read();
    },

    storeSave(json: string): void {
      try {
        bridge.storeSave(json);
      } catch {
        // keep going: the mirror below may still hold the save
      }
      // Mirror copy in the WebView's own storage; only ever read when the wrapper returns nothing.
      backup.write(json);
    },

    haptic(kind: HapticKind): void {
      try {
        bridge.haptic(kind);
      } catch {
        // haptics are a nicety
      }
    },

    setBackHandler(handler: () => boolean): void {
      backHandler = typeof handler === 'function' ? handler : null;
    },

    setAtRoot(atRoot: boolean): void {
      try {
        bridge.setAtRoot(atRoot === true);
      } catch {
        // the wrapper keeps its previous idea of where we are
      }
    },

    rateApp(): void {
      try {
        bridge.rate();
      } catch {
        // nothing to fall back to
      }
    },

    onPause: lifecycle.onPause,
    onResume: lifecycle.onResume,
  };
}

// ───────────────────────────── browser (and Node) ─────────────────────────────

function createWeb(win: Window | undefined): PlatformApi {
  const doc = win ? win.document : undefined;
  const lifecycle = createLifecycle(isHidden(doc));
  const storage = localSave(win);
  /** Used when localStorage is unavailable, so a session still reads back what it wrote. */
  let memory: string | null = null;
  let backHandler: (() => boolean) | null = null;

  watchVisibility(doc, lifecycle);
  try {
    if (win && typeof win.addEventListener === 'function') {
      win.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key !== 'Escape' && event.key !== 'Esc') return;
        if (event.repeat) return; // holding the key must not close several things in a row
        const handler = backHandler;
        if (!handler) return;
        let consumed = false;
        call(() => {
          consumed = handler() === true;
        });
        if (consumed && typeof event.preventDefault === 'function') event.preventDefault();
      });
    }
  } catch {
    // no keyboard events: Back is simply unavailable
  }

  return {
    info(): AppInfo {
      return {
        versionName: APP_VERSION_NAME,
        versionCode: APP_VERSION_CODE,
        locale: deviceLocale(win),
        platform: 'web',
      };
    },

    loadSave(): string | null {
      // `memory` is only set while the latest write could not reach localStorage — then it is newer.
      return memory !== null ? memory : storage.read();
    },

    storeSave(json: string): void {
      if (typeof json !== 'string') return;
      memory = storage.write(json) ? null : json;
    },

    haptic(kind: HapticKind): void {
      try {
        const nav = win ? win.navigator : undefined;
        const pattern = VIBRATION[kind];
        if (nav && typeof nav.vibrate === 'function' && pattern !== undefined) nav.vibrate(pattern);
      } catch {
        // not supported / not allowed yet
      }
    },

    setBackHandler(handler: () => boolean): void {
      backHandler = typeof handler === 'function' ? handler : null;
    },

    setAtRoot(): void {
      // The browser has no native Back to hand over to.
    },

    rateApp(): void {
      // No store page in a browser.
    },

    onPause: lifecycle.onPause,
    onResume: lifecycle.onResume,
  };
}

// ───────────────────────────── entry point ─────────────────────────────

/** Pick the implementation for where the game is running. Never throws. */
export function createPlatform(): PlatformApi {
  const win = typeof window !== 'undefined' ? window : undefined;
  let bridge: AndroidBridge | undefined;
  try {
    bridge = win ? win.AndroidBridge : undefined;
  } catch {
    bridge = undefined;
  }
  if (win && typeof bridge === 'object' && bridge !== null) return createAndroid(win, bridge);
  return createWeb(win);
}
