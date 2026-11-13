/**
 * Paints a chapter backdrop into a canvas that fills its container. The pixel count is capped:
 * backdrops are soft paintings, so on large or very dense screens they are painted a little
 * smaller and scaled up, which keeps both painting time and memory in check.
 */
import type { ArtApi, ChapterTheme } from '../../art/types.ts';

/** Upper bound of device pixels per backdrop canvas. */
export const BACKDROP_MAX_PIXELS = 1_600_000;

/** The scale (device pixels per CSS pixel) a w×h backdrop is painted at. */
export function backdropScale(w: number, h: number, dpr: number): number {
  const ratio = dpr > 0 && isFinite(dpr) ? dpr : 1;
  const area = Math.max(1, w * h);
  const fit = Math.sqrt(BACKDROP_MAX_PIXELS / area);
  const s = Math.min(ratio, 2, fit);
  return s < 0.5 ? 0.5 : s;
}

export function paintBackdropCanvas(art: ArtApi, theme: ChapterTheme, cssW: number, cssH: number): HTMLCanvasElement | null {
  const w = Math.max(1, Math.round(cssW));
  const h = Math.max(1, Math.round(cssH));
  const scale = backdropScale(w, h, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  canvas.className = 'm-backdrop';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  try {
    art.paintBackdrop(ctx, theme, canvas.width, canvas.height);
  } catch (err) {
    console.error('[ui] backdrop failed', err);
    return null;
  }
  return canvas;
}
