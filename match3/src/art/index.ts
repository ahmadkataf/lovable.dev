/**
 * Art module entry point: `createArt()` returns the ArtApi (src/art/types.ts).
 *
 * Everything is drawn procedurally with Canvas 2D; nothing touches the DOM until a sprite is first
 * requested, so importing this file (and even calling createArt) is safe under Node.
 *
 * Sprite conventions for the board renderer (px = cell size in device pixels):
 *  - `tileA` / `tileB` are full-bleed; draw them exactly on the cell rect.
 *  - `sand1` / `sand2`, `exit`: draw on the cell rect, above the tile and BELOW the piece.
 *  - gems, specials, lamp, stone, vine: draw on the cell rect (they carry their own margin and shadow).
 *  - `chain`, `select`: draw on the cell rect, above the piece.
 *  - `hint`: a ring-shaped halo, transparent in the middle; draw on the cell rect above or below
 *    the piece and pulse its alpha / scale.
 */
import { BRAND } from '../app/brand.ts';
import type { Color } from '../engine/types.ts';
import type { ArtApi, ChapterTheme, IconKey, SpriteKey, ThemePalette } from './types.ts';
import type { Ctx } from './util.ts';
import { ctx2d, dpr, makeCanvas } from './util.ts';
import { GEM_COLORS, drawBeam, drawGem, drawNova, drawPrism } from './gems.ts';
import { drawChain, drawLamp, drawSand, drawStone, drawVine } from './blockers.ts';
import { drawExit, drawHint, drawSelect, drawTile } from './board.ts';
import { drawIcon, isIconKey } from './icons.ts';
import { PALETTES, paintBackdrop } from './backdrops.ts';
import { LOGO_ASPECT, drawEmblem, drawLogo } from './logo.ts';

export type { ArtApi, ChapterTheme, IconKey, SpriteKey, ThemePalette } from './types.ts';
export { ICON_KEYS } from './icons.ts';

type Painter = (ctx: Ctx, px: number) => void;

function buildSpritePainters(): Record<SpriteKey, Painter> {
  const t = {} as Record<string, Painter>;
  for (let i = 0; i < 6; i++) {
    const c = i as Color;
    t['gem' + i] = (ctx, px) => drawGem(ctx, c, px);
    t['beamH' + i] = (ctx, px) => drawBeam(ctx, c, px, false);
    t['beamV' + i] = (ctx, px) => drawBeam(ctx, c, px, true);
    t['nova' + i] = (ctx, px) => drawNova(ctx, c, px);
  }
  t.prism = (ctx, px) => drawPrism(ctx, px);
  t.lamp = (ctx, px) => drawLamp(ctx, px);
  t.stone1 = (ctx, px) => drawStone(ctx, px, 1);
  t.stone2 = (ctx, px) => drawStone(ctx, px, 2);
  t.stone3 = (ctx, px) => drawStone(ctx, px, 3);
  t.vine = (ctx, px) => drawVine(ctx, px);
  t.chain = (ctx, px) => drawChain(ctx, px);
  t.sand1 = (ctx) => drawSand(ctx, 1);
  t.sand2 = (ctx) => drawSand(ctx, 2);
  t.tileA = (ctx) => drawTile(ctx, false);
  t.tileB = (ctx) => drawTile(ctx, true);
  t.exit = (ctx) => drawExit(ctx);
  t.select = (ctx, px) => drawSelect(ctx, px);
  t.hint = (ctx) => drawHint(ctx);
  return t as Record<SpriteKey, Painter>;
}

/** Every sprite key, in a stable order (gallery, tests). */
export const SPRITE_KEYS: readonly SpriteKey[] = (function list(): SpriteKey[] {
  const out: string[] = [];
  const kinds = ['gem', 'beamH', 'beamV', 'nova'];
  for (let k = 0; k < kinds.length; k++) for (let i = 0; i < 6; i++) out.push(kinds[k] + i);
  out.push('prism', 'lamp', 'stone3', 'stone2', 'stone1', 'vine', 'chain', 'sand1', 'sand2', 'tileA', 'tileB', 'exit', 'select', 'hint');
  return out as SpriteKey[];
})();

/** Sizes kept per key before the oldest is dropped (board size changes, a handful of icon sizes). */
const MAX_SIZES_PER_KEY = 8;

export function createArt(): ArtApi {
  let painters: Record<SpriteKey, Painter> | null = null;
  const sprites = new Map<string, Map<number, HTMLCanvasElement>>();
  const urls = new Map<string, Map<number, string>>();

  function render(key: string, px: number): HTMLCanvasElement {
    const c = makeCanvas(px, px);
    const ctx = ctx2d(c);
    if (isIconKey(key)) {
      ctx.scale(px / 24, px / 24);
      drawIcon(ctx, key, px);
    } else {
      if (!painters) painters = buildSpritePainters();
      const paint = painters[key as SpriteKey];
      if (paint) {
        ctx.scale(px / 100, px / 100);
        paint(ctx, px);
      } else if (typeof console !== 'undefined') {
        console.warn('[art] unknown key: ' + key);
      }
    }
    return c;
  }

  /** Cached master canvas for (key, px). No allocation on a cache hit. */
  function cached(key: string, px: number): HTMLCanvasElement {
    const size = px >= 1 ? Math.round(px) : 1;
    let bySize = sprites.get(key);
    if (!bySize) {
      bySize = new Map();
      sprites.set(key, bySize);
    }
    let c = bySize.get(size);
    if (!c) {
      if (bySize.size >= MAX_SIZES_PER_KEY) {
        const oldest = bySize.keys().next().value;
        if (oldest !== undefined) {
          bySize.delete(oldest);
          const u = urls.get(key);
          if (u) u.delete(oldest);
        }
      }
      c = render(key, size);
      bySize.set(size, c);
    }
    return c;
  }

  function cssCanvas(wCss: number, hCss: number): HTMLCanvasElement {
    const r = dpr();
    const c = makeCanvas(wCss * r, hCss * r);
    c.style.width = wCss + 'px';
    c.style.height = hCss + 'px';
    c.setAttribute('aria-hidden', 'true');
    return c;
  }

  return {
    sprite(key: SpriteKey, px: number): HTMLCanvasElement {
      return cached(key, px);
    },

    icon(key: IconKey | SpriteKey, cssPx: number): HTMLCanvasElement {
      const c = cssCanvas(cssPx, cssPx);
      ctx2d(c).drawImage(cached(key, c.width), 0, 0);
      return c;
    },

    iconUrl(key: IconKey | SpriteKey, cssPx: number): string {
      const px = Math.max(1, Math.round(cssPx * dpr()));
      let bySize = urls.get(key);
      if (!bySize) {
        bySize = new Map();
        urls.set(key, bySize);
      }
      let url = bySize.get(px);
      if (url === undefined) {
        url = cached(key, px).toDataURL('image/png');
        bySize.set(px, url);
      }
      return url;
    },

    gemColor(color: Color): string {
      return GEM_COLORS[color] || GEM_COLORS[0];
    },

    palette(theme: ChapterTheme): ThemePalette {
      return PALETTES[theme] || PALETTES.oasis;
    },

    paintBackdrop(ctx: CanvasRenderingContext2D, theme: ChapterTheme, w: number, h: number): void {
      paintBackdrop(ctx, theme, w, h);
    },

    logo(cssW: number, lang: 'en' | 'ar'): HTMLCanvasElement {
      const c = cssCanvas(cssW, Math.round(cssW * LOGO_ASPECT));
      const which = lang === 'ar' ? 'ar' : 'en';
      drawLogo(ctx2d(c), c.width, which, BRAND.name[which], BRAND.tagline[which]);
      return c;
    },

    emblem(px: number): HTMLCanvasElement {
      const size = px >= 1 ? Math.round(px) : 1;
      const c = makeCanvas(size, size);
      const ctx = ctx2d(c);
      ctx.scale(size / 100, size / 100);
      drawEmblem(ctx, size);
      return c;
    },
  };
}
