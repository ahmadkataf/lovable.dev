/**
 * Board furniture: checkerboard tiles, exit marker, selection ring, hint glow.
 * All drawn in a 100×100 unit box. Tiles are full-bleed (no margin) so they tile seamlessly.
 */
import type { Ctx } from './util.ts';
import { PAL, TAU, khatam, lGrad, rgba, rrect } from './util.ts';

export const TILE_A = '#34308a';
export const TILE_B = '#2a2672';

/** One checkerboard cell. `alt` = the darker of the two tones. */
export function drawTile(ctx: Ctx, alt: boolean): void {
  const base = alt ? TILE_B : TILE_A;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 100, 100);
  // soft pillow: a little light in the middle, a little weight at the bottom
  const g = ctx.createRadialGradient(50, 44, 4, 50, 50, 72);
  g.addColorStop(0, 'rgba(150,140,255,0.10)');
  g.addColorStop(1, 'rgba(10,6,40,0.14)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 100, 100);
  // faint inlaid khatam, the board's watermark
  ctx.lineJoin = 'miter';
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = alt ? 'rgba(160,150,255,0.07)' : 'rgba(170,160,255,0.085)';
  ctx.beginPath();
  khatam(ctx, 50, 50, 27, -Math.PI / 2);
  ctx.stroke();
  // hairline bevel so neighbouring cells read as inlaid tiles
  ctx.fillStyle = 'rgba(190,180,255,0.07)';
  ctx.fillRect(0, 0, 100, 1.6);
  ctx.fillRect(0, 0, 1.6, 100);
  ctx.fillStyle = 'rgba(8,5,34,0.2)';
  ctx.fillRect(0, 98.4, 100, 1.6);
  ctx.fillRect(98.4, 0, 1.6, 100);
}

/**
 * Exit marker: drawn over the tile and under the piece. A warm glow rising from the cell's
 * bottom edge with small downward chevrons (left / centre / right so two stay visible beside a gem).
 */
export function drawExit(ctx: Ctx): void {
  ctx.fillStyle = lGrad(ctx, 0, 58, 0, 100, [
    [0, rgba(PAL.gold, 0)],
    [0.7, rgba(PAL.gold, 0.26)],
    [1, rgba(PAL.goldLight, 0.62)],
  ]);
  ctx.fillRect(0, 58, 100, 42);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const xs = [14, 50, 86];
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass === 0 ? 'rgba(60,34,4,0.75)' : PAL.goldLight;
    ctx.lineWidth = pass === 0 ? 5.6 : 3.2;
    ctx.beginPath();
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i];
      ctx.moveTo(x - 7.5, 84.5);
      ctx.lineTo(x, 92.5);
      ctx.lineTo(x + 7.5, 84.5);
    }
    ctx.stroke();
  }
  ctx.fillStyle = rgba(PAL.cream, 0.9);
  ctx.fillRect(0, 97.4, 100, 2.6);
}

/** Selection ring: crisp gold-white rounded frame with heavier corners. */
export function drawSelect(ctx: Ctx, px: number): void {
  const frame = new Path2D();
  rrect(frame, 7.5, 7.5, 85, 85, 19);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(255,220,120,0.95)';
  ctx.shadowBlur = px * 0.045;
  ctx.strokeStyle = 'rgba(40,22,4,0.6)';
  ctx.lineWidth = 7.4;
  ctx.stroke(frame);
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = lGrad(ctx, 0, 4, 0, 96, [
    [0, '#ffffff'],
    [0.5, PAL.goldLight],
    [1, PAL.gold],
  ]);
  ctx.lineWidth = 4.2;
  ctx.stroke(frame);
  // corner brackets
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6.4;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = Math.PI + (i * Math.PI) / 2;
    const cx = i === 0 || i === 3 ? 26.5 : 73.5;
    const cy = i < 2 ? 26.5 : 73.5;
    ctx.moveTo(cx + Math.cos(a + 0.2) * 19, cy + Math.sin(a + 0.2) * 19);
    ctx.arc(cx, cy, 19, a + 0.2, a + Math.PI / 2 - 0.2);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Hint glow: a soft, ring-shaped halo that sits out near the cell edge, so it shows all round a
 * piece that fills most of the cell and never washes out the piece itself.
 */
export function drawHint(ctx: Ctx): void {
  const g = ctx.createRadialGradient(50, 50, 28, 50, 50, 50);
  g.addColorStop(0, 'rgba(255,246,220,0)');
  g.addColorStop(0.42, 'rgba(255,240,190,0.5)');
  g.addColorStop(0.72, 'rgba(255,252,232,0.98)');
  g.addColorStop(0.88, 'rgba(255,225,140,0.5)');
  g.addColorStop(1, 'rgba(255,210,100,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(50, 50, 50, 0, TAU);
  ctx.fill();
}
