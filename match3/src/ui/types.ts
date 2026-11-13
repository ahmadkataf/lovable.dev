/**
 * Shared types of the app shell (src/ui): what every screen and dialog of the meta game receives.
 */
import type { AppContext } from '../app/types.ts';
import type { ChapterTheme } from '../art/types.ts';
import type { LevelDef, StartBoosters } from '../engine/types.ts';
import type { FeatureId } from '../state/extensions.ts';
import type { BoosterId } from '../state/types.ts';
import type { Kit } from './kit/index.ts';
import type { Flags } from './flags.ts';
import type { Tick } from './ticker.ts';

export type ScreenKind = 'title' | 'map' | 'play';

/** A chapter of the journey (structurally the same as the `Chapter` of src/levels). */
export interface ChapterInfo {
  /** 0-based */
  index: number;
  theme: ChapterTheme;
  /** i18n key of the chapter name */
  nameKey: string;
  /** first and last level id (inclusive) */
  from: number;
  to: number;
}

/** The level list the shell runs on: the real one, or a generated one for tests (?mocklevels=N). */
export interface World {
  levels: readonly LevelDef[];
  chapters: readonly ChapterInfo[];
}

/** One full-screen view inside the stage. */
export interface Screen {
  readonly el: HTMLElement;
  /** Called once the element is in the document (layout can be measured). */
  shown?(): void;
  /** Called before the element is removed: stop timers, drop listeners. */
  dispose?(): void;
  /** Back button; true = consumed. */
  handleBack?(): boolean;
  /** App went to the background / came back. */
  setPaused?(paused: boolean): void;
}

/** What screens and dialogs get: the app context plus the shell's own services. */
export interface Ui {
  readonly ctx: AppContext;
  readonly kit: Kit;
  readonly world: World;
  readonly flags: Flags;
  /** Shorthand for ctx.i18n.t. */
  t(key: string, vars?: Record<string, string | number>): string;
  /** Feature gating (docs/DESIGN.md §5); everything counts as unlocked with the `?gate=off` debug flag. */
  feature(id: FeatureId): boolean;
  boosterUnlocked(id: BoosterId): boolean;
  chapterOf(levelId: number): ChapterInfo;
  /** The screen that is showing now. */
  screen(): ScreenKind | null;
  /**
   * Run `tick` now and then whenever the countdown it shows moves on a second (it returns the
   * milliseconds left, or nothing when no countdown runs: then once a second). Nothing ticks
   * while the app is in the background; coming back ticks at once. Returns the stop function.
   */
  ticker(tick: Tick): () => void;

  /**
   * Start a level from its intro: takes the `paid` start boosters out of the inventory, adds the
   * `free` ones (the Caravan's) and enters the play screen. Returns false — with the paid boosters
   * back in the inventory — when the level could not be started.
   */
  startLevel(levelId: number, paid: StartBoosters, free: StartBoosters): boolean;

  goTitle(): void;
  /** Lives dialog (count, countdown, refill, rewarded life). Resolves when closed. */
  openLives(): Promise<void>;
  openDaily(): Promise<void>;
  /** Grants pending booster-unlock gifts and introduces them. Resolves when the dialog(s) closed. */
  showUnlocks(): Promise<void>;
  /** Tell the wrapper whether Back should leave the app (title screen, nothing open). */
  syncRoot(): void;
}
