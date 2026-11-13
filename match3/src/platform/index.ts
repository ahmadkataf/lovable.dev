/**
 * Platform bridge: the one module that knows where the game runs.
 *  - Inside the Android wrapper (`window.AndroidBridge` exists): saves, haptics, Back and lifecycle
 *    go through the native bridge. Every bridge call is guarded — a failing bridge never reaches the game.
 *  - Anywhere else (dev server, tests, screenshots): localStorage, navigator.vibrate, the Escape key
 *    as Back and the Page Visibility API.
 *
 * Nothing here touches `window` at import time, so the module loads under Node as well; there
 * `createPlatform()` returns a harmless in-memory implementation.
 *
 * Behaviour worth knowing when you use it:
 *  - Nothing in this module throws, whatever the bridge, the storage or a listener does.
 *  - Pause is "sticky": a listener given to `onPause` while the app is already in the background
 *    (the page was opened hidden, or the wrapper paused before the game finished starting) is
 *    called right away, so whoever registers late still learns that the app is paused. `onResume`
 *    listeners are only ever called on a real return.
 *  - Back does nothing until `setBackHandler` was called; hooks may fire before or after it.
 *  - `window.__native` is shared with other modules (the store adds its own hook): add to it with
 *    `window.__native.x = …`. Assigning a whole new object is tolerated — its properties are merged
 *    in, and back / pause / resume stay this module's.
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
  // A number, or a string of digits (some bridges stringify everything).
  const code = typeof o.versionCode === 'string' && /^\d{1,15}$/.test(o.versionCode) ? Number(o.versionCode) : o.versionCode;
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

function isHapticKind(kind: unknown): kind is HapticKind {
  return typeof kind === 'string' && Object.prototype.hasOwnProperty.call(VIBRATION, kind);
}

function call(fn: () => void): void {
  try {
    fn();
  } catch (err) {
    try {
      if (typeof console !== 'undefined') console.error('[platform] listener failed', err);
    } catch {
      // even logging failed: nothing left to do, and nothing may escape from here
    }
  }
}

/** Read something from a host object that may throw on access (a hostile or half-built window). */
function read<T>(get: () => T): T | undefined {
  try {
    return get();
  } catch {
    return undefined;
  }
}

/**
 * True when `text` holds a JSON object — directly, or wrapped once more as a JSON string (a bridge
 * that encodes twice). Used only to choose between two copies of the save; never to interpret it.
 */
function holdsJsonObject(text: unknown): boolean {
  if (typeof text !== 'string' || text.length === 0) return false;
  try {
    let value: unknown = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
    if (typeof value === 'string') value = JSON.parse(value);
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  } catch {
    return false;
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
      if (typeof listener !== 'function') return;
      pauseListeners.push(listener);
      // Sticky: the pause that happened before this listener existed is delivered now (see the header).
      if (paused) call(listener);
    },
    onResume(listener) {
      if (typeof listener !== 'function') return;
      resumeListeners.push(listener);
    },
    setPaused(next) {
      if (next === paused) return;
      paused = next;
      for (const listener of (next ? pauseListeners : resumeListeners).slice()) {
        // A listener may itself report a change (rare, but possible): later listeners of the
        // outdated round are skipped, they are told the newer state by the nested round.
        if (paused !== next) break;
        call(listener);
      }
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

/** `window.document`, or undefined when there is none or it cannot be read. */
function documentOf(win: Window | undefined): Document | undefined {
  const doc = win ? read(() => win.document) : undefined;
  return typeof doc === 'object' && doc !== null ? doc : undefined;
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
        // Some private modes accept the call and keep nothing: only a value that reads back counts.
        return store.getItem(SAVE_KEY) === value;
      } catch {
        return false;
      }
    },
  };
}

// ───────────────────────────── Android ─────────────────────────────

/**
 * Publish the hooks the wrapper calls as `window.__native`.
 * They are merged into an object that is already there, so hooks registered earlier by other
 * modules (the store) survive. And because a module that starts LATER might assign a whole new
 * object, `__native` becomes an accessor: such an assignment merges the newcomer's properties in
 * instead of dropping back / pause / resume.
 */
function installHooks(win: Window, own: NativeHooks): void {
  const owned = own as unknown as Record<string, unknown>;
  let hooks: Record<string, unknown> = {};
  try {
    const existing: unknown = win.__native;
    if (typeof existing === 'object' && existing !== null) hooks = existing as Record<string, unknown>;
  } catch {
    // unreadable: start from an empty object
  }
  const adopt = (): void => {
    for (const name of Object.keys(owned)) hooks[name] = owned[name];
  };
  try {
    adopt();
  } catch {
    // the existing object refuses new properties: publish our own object instead, with its other hooks copied
    const fresh: Record<string, unknown> = {};
    try {
      for (const name of Object.keys(hooks)) fresh[name] = hooks[name];
    } catch {
      // nothing to carry over
    }
    hooks = fresh;
    adopt();
  }
  try {
    Object.defineProperty(win, '__native', {
      configurable: true,
      enumerable: true,
      get: () => hooks,
      set: (next: unknown) => {
        if (typeof next !== 'object' || next === null || next === hooks) return;
        try {
          for (const name of Object.keys(next)) {
            if (!Object.prototype.hasOwnProperty.call(owned, name)) hooks[name] = (next as Record<string, unknown>)[name];
          }
        } catch {
          // an object that cannot be read: ignore it
        }
      },
    });
  } catch {
    try {
      win.__native = hooks as unknown as NativeHooks; // no accessors on this window: a plain property
    } catch {
      // a frozen window object: nothing more we can do
    }
  }
}

function createAndroid(win: Window, bridge: AndroidBridge): PlatformApi {
  const lifecycle = createLifecycle(false);
  const backup = localSave(win);
  let backHandler: (() => boolean) | null = null;
  let cachedInfo: AppInfo | null = null;

  installHooks(win, {
    back: () => {
      const handler = backHandler;
      if (handler) call(() => void handler());
    },
    pause: () => lifecycle.setPaused(true),
    resume: () => lifecycle.setPaused(false),
  });
  // The WebView also reports visibility; together with the hooks, whichever arrives first wins.
  watchVisibility(documentOf(win), lifecycle);

  return {
    info(): AppInfo {
      if (!cachedInfo) {
        let raw: unknown = null;
        let ok = false;
        try {
          raw = bridge.info();
          ok = true;
        } catch {
          raw = null;
        }
        const info = parseAndroidInfo(raw, deviceLocale(win));
        if (!ok) return info; // the call itself failed: answer with the fallback and ask again next time
        cachedInfo = info;
      }
      return { ...cachedInfo }; // a copy: callers cannot alter what the next caller gets
    },

    loadSave(): string | null {
      let native: unknown = null;
      try {
        native = bridge.loadSave();
      } catch {
        native = null;
      }
      const fromWrapper = typeof native === 'string' && native.length > 0 ? native : null;
      if (fromWrapper !== null && holdsJsonObject(fromWrapper)) return fromWrapper;
      // Nothing usable from the wrapper (first run, a failing bridge, or text that is not a save):
      // fall back to the mirror copy — but never prefer unreadable text over readable text.
      const mirror = backup.read();
      if (mirror !== null && (fromWrapper === null || holdsJsonObject(mirror))) return mirror;
      return fromWrapper;
    },

    storeSave(json: string): void {
      if (typeof json !== 'string') return;
      try {
        bridge.storeSave(json);
      } catch {
        // keep going: the mirror below may still hold the save
      }
      // Mirror copy in the WebView's own storage; only read when the wrapper has nothing usable.
      backup.write(json);
    },

    haptic(kind: HapticKind): void {
      if (!isHapticKind(kind)) return;
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
  const doc = documentOf(win);
  const lifecycle = createLifecycle(isHidden(doc));
  const storage = localSave(win);
  /** Used when localStorage is unavailable, so a session still reads back what it wrote. */
  let memory: string | null = null;
  let backHandler: (() => boolean) | null = null;

  watchVisibility(doc, lifecycle);
  try {
    if (win && typeof win.addEventListener === 'function') {
      win.addEventListener('keydown', (event: KeyboardEvent) => {
        if (!event || (event.key !== 'Escape' && event.key !== 'Esc')) return;
        if (event.repeat) return; // holding the key must not close several things in a row
        const handler = backHandler;
        if (!handler) return;
        call(() => {
          if (handler() === true && typeof event.preventDefault === 'function') event.preventDefault();
        });
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
        if (nav && typeof nav.vibrate === 'function' && isHapticKind(kind)) nav.vibrate(VIBRATION[kind]);
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
