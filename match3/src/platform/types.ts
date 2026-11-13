/**
 * Platform contract: the only place that knows whether the game runs inside the Android
 * WebView wrapper or in a plain browser (dev, tests, screenshots).
 */
export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'error';

export interface AppInfo {
  versionName: string;
  versionCode: number;
  /** BCP-47 language tag of the device, e.g. "ar-SY", "en-US". */
  locale: string;
  platform: 'android' | 'web';
}

export interface PlatformApi {
  info(): AppInfo;
  /** Raw save string, or null when nothing was saved yet. Never throws. */
  loadSave(): string | null;
  /** Persist the save string. Never throws. */
  storeSave(json: string): void;
  haptic(kind: HapticKind): void;
  /**
   * Hardware/gesture Back. The handler returns true when it consumed the press.
   * (In a browser the Escape key triggers it.)
   */
  setBackHandler(handler: () => boolean): void;
  /**
   * Tell the wrapper whether the game is on its root screen with nothing to close.
   * At the root, Android handles Back itself (predictive back-to-home animation, app goes to background).
   */
  setAtRoot(atRoot: boolean): void;
  /** Open this game's store page for rating. No-op in a browser. */
  rateApp(): void;
  /** App moved to background / returned. */
  onPause(listener: () => void): void;
  onResume(listener: () => void): void;
}

/**
 * Object injected by the Android wrapper as `window.AndroidBridge` (addJavascriptInterface).
 * Every method is synchronous and must never throw into JS.
 */
export interface AndroidBridge {
  /** "" when nothing saved. */
  loadSave(): string;
  storeSave(json: string): void;
  haptic(kind: string): void;
  setAtRoot(atRoot: boolean): void;
  /** JSON of AppInfo (without `platform`). */
  info(): string;
  rate(): void;
}

/**
 * Hooks the wrapper calls with evaluateJavascript:
 *   window.__native.back()   — Back pressed while not at root
 *   window.__native.pause()  — Activity.onPause
 *   window.__native.resume() — Activity.onResume
 */
export interface NativeHooks {
  back(): void;
  pause(): void;
  resume(): void;
}

declare global {
  interface Window {
    AndroidBridge?: AndroidBridge;
    __native?: NativeHooks;
  }
}
