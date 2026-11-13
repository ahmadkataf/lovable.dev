/**
 * Application wiring contract: what every screen receives, and how screens hand over to each other.
 */
import type { LevelDef, StartBoosters } from '../engine/types.ts';
import type { ArtApi } from '../art/types.ts';
import type { AudioApi } from '../audio/types.ts';
import type { I18nApi } from '../i18n/types.ts';
import type { PlatformApi } from '../platform/types.ts';
import type { ProfileApi } from '../state/types.ts';
import type { StoreApi } from '../monetize/types.ts';

export interface AppContext {
  art: ArtApi;
  audio: AudioApi;
  i18n: I18nApi;
  platform: PlatformApi;
  profile: ProfileApi;
  /** Real-money purchases and ads (unavailable ⇒ offers are simply hidden). */
  store: StoreApi;
  /** All levels, index 0 = level 1. */
  levels: readonly LevelDef[];
  nav: Navigator;
}

/** Implemented by the app shell (src/ui). Screens call it; they never touch each other directly. */
export interface Navigator {
  /** Show the level map, optionally scrolled to / celebrating a level. */
  toMap(opts?: { focusLevel?: number; justWon?: number }): void;
  /**
   * Open the pre-level dialog (goals, start boosters, Play button) for a level.
   * Handles "no lives" itself (offers refill / wait).
   */
  openLevelIntro(levelId: number): void;
  /** Enter the play screen. Called by the level intro once the player presses Play. */
  toPlay(levelId: number, boosters: StartBoosters): void;
  /** Open the booster/coin shop as an overlay (returns when closed). */
  openShop(): Promise<void>;
  openSettings(): Promise<void>;
}

/** Implemented by src/play. The shell owns one instance and mounts `el` when playing. */
export interface PlayScreen {
  readonly el: HTMLElement;
  /** Start (or restart) a level. Resolves nothing; the screen calls ctx.nav when the player leaves. */
  start(level: LevelDef, boosters: StartBoosters): void;
  /** Stop everything and release resources of the current level (called when navigating away). */
  stop(): void;
  /** Back button: returns true if consumed (e.g. opened/closed the pause dialog). */
  handleBack(): boolean;
  /** App paused / resumed (stop timers, hint pulse, etc.). */
  setPaused(paused: boolean): void;
}
