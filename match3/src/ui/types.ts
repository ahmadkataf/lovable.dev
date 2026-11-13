/**
 * Shared types of the app shell (src/ui): what every screen and dialog of the meta game receives.
 */
import type { AppContext } from '../app/types.ts';
import type { ChapterTheme } from '../art/types.ts';
import type { LevelDef } from '../engine/types.ts';
import type { FeatureId } from '../state/extensions.ts';
import type { BoosterId } from '../state/types.ts';
import type { Kit } from './kit/index.ts';
import type { Flags } from './flags.ts';

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
  /** Feature gating (docs/DESIGN.md §5); everything is on when the profile has no gating yet. */
  feature(id: FeatureId): boolean;
  boosterUnlocked(id: BoosterId): boolean;
  chapterOf(levelId: number): ChapterInfo;

  goTitle(): void;
  /** Lives dialog (count, countdown, refill, rewarded life). Resolves when closed. */
  openLives(): Promise<void>;
  openDaily(): Promise<void>;
  /** Grants pending booster-unlock gifts and introduces them. Resolves when the dialog(s) closed. */
  showUnlocks(): Promise<void>;
  /** Tell the wrapper whether Back should leave the app (title screen, nothing open). */
  syncRoot(): void;
}
