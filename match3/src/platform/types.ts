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
  /**
   * Optional (feature-detect it). Tell the wrapper that the first screen is on display, so it can
   * take its splash screen away. Without this call the splash screen leaves by itself after 3 s.
   * Animation frames do run behind the splash screen, so waiting for one before calling is fine.
   */
  ready?(): void;
  /**
   * Optional (feature-detect it). JSON `{"top":n,"right":n,"bottom":n,"left":n}` in CSS pixels:
   * how much of each edge is covered by the display cutout or by a visible system bar. The wrapper
   * draws the page edge to edge and never pads it, so the UI must keep clear of these areas itself.
   * (CSS `env(safe-area-inset-*)` is not reliable in older WebViews; this is.)
   */
  insets?(): string;
}

/**
 * Hooks the wrapper calls with evaluateJavascript:
 *   window.__native.back()   — Back pressed while not at root
 *   window.__native.pause()  — Activity.onPause
 *   window.__native.resume() — Activity.onResume
 *   window.__native.insets(json) — the insets changed (also sent once when the page has loaded);
 *                                  same JSON as AndroidBridge.insets()
 */
export interface NativeHooks {
  back(): void;
  pause(): void;
  resume(): void;
  /** Optional: install it to follow inset changes (rotation, cutout, bars shown or hidden). */
  insets?(json: string): void;
}

declare global {
  interface Window {
    AndroidBridge?: AndroidBridge;
    __native?: NativeHooks;
  }
}
