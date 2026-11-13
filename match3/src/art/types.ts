/**
 * Art contract. ALL graphics are original and drawn procedurally with Canvas 2D at runtime
 * (no image files, no third-party art). Sprites are cached per (key, pixel size).
 * Visual direction: docs/DESIGN.md §3.
 */
import type { Color } from '../engine/types.ts';

export type SpriteKey =
  /** plain gems, one distinct silhouette per colour */
  | `gem${Color}`
  /** line-clearing gems: the gem plus a clear horizontal / vertical light streak */
  | `beamH${Color}`
  | `beamV${Color}`
  /** area-blast gems: the gem inside a glowing ring/aura */
  | `nova${Color}`
  /** colour wildcard: eight-pointed star with a rainbow sheen */
  | 'prism'
  /** drop item: a small brass oil lamp */
  | 'lamp'
  /** stone blocker with 1, 2, 3 layers left (3 = intact, 1 = heavily cracked) */
  | 'stone1'
  | 'stone2'
  | 'stone3'
  /** spreading blocker: a knot of thorny green vine filling the cell */
  | 'vine'
  /** overlay drawn on top of a chained piece */
  | 'chain'
  /** floor overlays: 1 layer (thin, translucent) and 2 layers (thick) of sand */
  | 'sand1'
  | 'sand2'
  /** board cell backgrounds for the checkerboard */
  | 'tileA'
  | 'tileB'
  /** small marker drawn under exit cells (where lamps leave) */
  | 'exit'
  /** selection ring and hint glow */
  | 'select'
  | 'hint';

export type IconKey =
  | 'heart' | 'coin' | 'star' | 'starEmpty' | 'moves' | 'score'
  | 'settings' | 'pause' | 'play' | 'close' | 'back' | 'lock' | 'check' | 'plus' | 'info'
  | 'home' | 'retry' | 'next' | 'shop' | 'gift' | 'calendar' | 'trophy' | 'map'
  | 'sound' | 'soundOff' | 'music' | 'musicOff' | 'haptics' | 'hapticsOff' | 'language' | 'shield' | 'trash'
  /** boosters */
  | 'hammer' | 'freeSwap' | 'shuffle' | 'extraMoves' | 'prismBooster' | 'beamNova'
  /** goal icons that are not sprites */
  | 'goalScore' | 'goalSand' | 'goalStone' | 'goalVine' | 'goalChain';

export type ChapterTheme = 'oasis' | 'dunes' | 'bazaar' | 'palace' | 'caverns' | 'stars';

export interface ThemePalette {
  /** background gradient, top → bottom */
  bgTop: string;
  bgBottom: string;
  /** accent used for path, banners and highlights */
  accent: string;
  /** colour of the board frame */
  frame: string;
}

export interface ArtApi {
  /** Cached square sprite rendered at `px` device pixels (drawn with a small transparent margin). */
  sprite(key: SpriteKey, px: number): HTMLCanvasElement;
  /** A NEW canvas of `cssPx` CSS pixels (backed by cssPx*dpr device pixels) for use as a DOM node. */
  icon(key: IconKey | SpriteKey, cssPx: number): HTMLCanvasElement;
  /** Cached PNG data URL of an icon/sprite at `cssPx`*dpr, for <img> / CSS backgrounds. */
  iconUrl(key: IconKey | SpriteKey, cssPx: number): string;
  /** Main colour of a gem colour (particles, goal chips, text accents). */
  gemColor(color: Color): string;
  palette(theme: ChapterTheme): ThemePalette;
  /**
   * Paint a full backdrop (sky gradient + stars/dunes/arches… per theme) into ctx covering w×h
   * device pixels. Deterministic for the same arguments.
   */
  paintBackdrop(ctx: CanvasRenderingContext2D, theme: ChapterTheme, w: number, h: number): void;
  /** Game logo (emblem + wordmark in the given language) on a transparent canvas `cssW` wide. */
  logo(cssW: number, lang: 'en' | 'ar'): HTMLCanvasElement;
  /** App emblem only (the launcher-icon artwork) on a transparent square canvas of `px` device pixels. */
  emblem(px: number): HTMLCanvasElement;
}
