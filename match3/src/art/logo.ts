/**
 * App emblem (launcher-icon artwork) and the game logo (emblem + wordmark).
 *
 * Emblem: the game's emerald ("zumurud" means emerald) set in a faceted gold khatam star on a round
 * indigo medallion. The star and jewel stay inside the middle 66% of the canvas (the Android
 * adaptive-icon safe zone); the medallion plate around them is expendable background.
 */
import type { Ctx } from './util.ts';
import { PAL, TAU, circle, khatamPts, lGrad, poly, rgba, rrect, sparkle } from './util.ts';
import { drawGem } from './gems.ts';

export const LOGO_FONT = '"Baloo Bhaijaan 2 Variable", "Baloo Bhaijaan 2", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Height of the logo canvas relative to its width. */
export const LOGO_ASPECT = 0.9;

/** Emblem in a 100×100 unit box. */
export function drawEmblem(ctx: Ctx, px: number): void {
  const cx = 50;
  const cy = 50;

  // medallion plate
  const plate = new Path2D();
  circle(plate, cx, cy, 47.2);
  const pg = ctx.createRadialGradient(cx, cy - 6, 4, cx, cy, 48);
  pg.addColorStop(0, '#6248c8');
  pg.addColorStop(0.5, '#33267f');
  pg.addColorStop(1, '#17123f');
  ctx.fillStyle = pg;
  ctx.fill(plate);
  ctx.save();
  ctx.clip(plate);
  // quiet rays behind the star
  ctx.fillStyle = 'rgba(255,231,163,0.08)';
  for (let i = 0; i < 16; i++) {
    const a0 = (i / 16) * TAU - 0.07;
    const a1 = (i / 16) * TAU + 0.07;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a0) * 50, cy + Math.sin(a0) * 50);
    ctx.lineTo(cx + Math.cos(a1) * 50, cy + Math.sin(a1) * 50);
    ctx.closePath();
    ctx.fill();
  }
  const halo = ctx.createRadialGradient(cx, cy, 12, cx, cy, 46);
  halo.addColorStop(0, 'rgba(255,222,130,0.55)');
  halo.addColorStop(1, 'rgba(255,214,120,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 100, 100);
  ctx.restore();
  // gold rim
  ctx.lineWidth = 3.6;
  ctx.strokeStyle = '#3d2608';
  const rimPath = new Path2D();
  circle(rimPath, cx, cy, 45.4);
  ctx.stroke(rimPath);
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = lGrad(ctx, 15, 8, 85, 92, [
    [0, '#fff3c4'],
    [0.4, PAL.gold],
    [0.75, '#c58c2c'],
    [1, PAL.goldLight],
  ]);
  ctx.stroke(rimPath);
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = 'rgba(255,231,163,0.42)';
  ctx.beginPath();
  ctx.arc(cx, cy, 41.4, 0, TAU);
  ctx.stroke();

  // gold khatam star: as large as the launcher safe zone allows
  const R = 32.6;
  const pts = khatamPts(cx, cy, R, -Math.PI / 2);
  const star = new Path2D();
  poly(star, pts);
  ctx.save();
  ctx.shadowColor = 'rgba(6,4,28,0.7)';
  ctx.shadowBlur = px * 0.045;
  ctx.shadowOffsetY = px * 0.022;
  ctx.fillStyle = '#5a3606';
  ctx.fill(star);
  ctx.restore();
  ctx.fillStyle = lGrad(ctx, 20, 14, 80, 88, [
    [0, '#ffeaa8'],
    [0.5, PAL.gold],
    [1, '#d2972c'],
  ]);
  ctx.fill(star);
  // folded facets: each point has a lit half and a shaded half
  for (let i = 0; i < 8; i++) {
    const tip = 2 * i;
    const prev = (tip + 15) % 16;
    const next = (tip + 1) % 16;
    const a = -Math.PI / 2 + (i * TAU) / 8;
    // normals of the two halves, tested against a light from the top-left
    const sl = Math.cos(a - Math.PI / 2) * -0.6 + Math.sin(a - Math.PI / 2) * -0.8;
    const sr = -sl;
    const halves: [number, number][] = [
      [prev, sl],
      [next, sr],
    ];
    for (let k = 0; k < 2; k++) {
      const s = halves[k][1];
      ctx.fillStyle = s >= 0 ? 'rgba(255,250,224,' + (0.18 + s * 0.62).toFixed(3) + ')' : 'rgba(128,70,8,' + (0.12 - s * 0.55).toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(pts[2 * halves[k][0]], pts[2 * halves[k][0] + 1]);
      ctx.lineTo(pts[2 * tip], pts[2 * tip + 1]);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,248,220,0.6)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let i = 0; i < 16; i += 2) {
    ctx.moveTo(cx, cy);
    ctx.lineTo(pts[2 * i], pts[2 * i + 1]);
  }
  ctx.stroke();
  ctx.strokeStyle = '#5a3606';
  ctx.lineWidth = 1.5;
  ctx.stroke(star);

  // bezel: a rounded-square gold collar that echoes the emerald's own cut
  const K = 0.4; // scale of the game's emerald sprite inside the emblem
  const half = 39.5 * K + 2.3;
  const bezel = new Path2D();
  rrect(bezel, cx - half, cy - half, half * 2, half * 2, 15 * K + 2.2);
  ctx.save();
  ctx.shadowColor = 'rgba(60,30,4,0.6)';
  ctx.shadowBlur = px * 0.02;
  ctx.shadowOffsetY = px * 0.01;
  ctx.fillStyle = '#4a2c08';
  ctx.fill(bezel);
  ctx.restore();
  ctx.lineWidth = 2.3;
  ctx.strokeStyle = lGrad(ctx, cx - half, cy - half, cx + half, cy + half, [
    [0, '#fff6cf'],
    [0.5, '#e0aa3e'],
    [1, '#8a5814'],
  ]);
  const collar = new Path2D();
  rrect(collar, cx - half + 1.15, cy - half + 1.15, half * 2 - 2.3, half * 2 - 2.3, 15 * K + 1);
  ctx.stroke(collar);

  // the jewel: the very emerald the player matches on the board
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(K, K);
  ctx.translate(-50, -48.4);
  drawGem(ctx, 2, px * K, false);
  ctx.restore();

  // glints
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  sparkle(ctx, 27.5, 26, 5.8, 0.2);
  ctx.fill();
  ctx.fillStyle = rgba('#ffffff', 0.9);
  ctx.beginPath();
  sparkle(ctx, 71, 69, 3.2, 0.22);
  ctx.fill();
}

function ornament(ctx: Ctx, x0: number, x1: number, y: number, s: number): void {
  // thin gold rule ending in a small khatam at its outer end (x1)
  ctx.strokeStyle = rgba(PAL.gold, 0.9);
  ctx.lineWidth = Math.max(1, s * 0.09);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  ctx.fillStyle = PAL.goldLight;
  ctx.beginPath();
  poly(ctx, khatamPts(x1, y, s * 0.42, -Math.PI / 2));
  ctx.fill();
}

/**
 * Logo: emblem on top, wordmark and tagline below. `W` × `W * LOGO_ASPECT` device pixels.
 * Text is shaped by the browser (`direction` is set for Arabic; strings are never reversed).
 */
export function drawLogo(ctx: Ctx, W: number, lang: 'en' | 'ar', name: string, tagline: string): void {
  const E = W * 0.5;
  ctx.save();
  ctx.translate((W - E) / 2, 0);
  ctx.scale(E / 100, E / 100);
  drawEmblem(ctx, E);
  ctx.restore();

  ctx.save();
  ctx.direction = lang === 'ar' ? 'rtl' : 'ltr';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';

  // wordmark: fit into its band
  const bandTop = W * 0.5;
  const bandH = W * 0.27;
  ctx.font = '800 100px ' + LOGO_FONT;
  const m = ctx.measureText(name);
  const asc = m.actualBoundingBoxAscent || 72;
  const desc = m.actualBoundingBoxDescent || 4;
  const size = Math.min((W * 0.9) / Math.max(1, m.width), (bandH * 0.92) / (asc + desc)) * 100;
  ctx.font = '800 ' + size.toFixed(2) + 'px ' + LOGO_FONT;
  const a = (asc * size) / 100;
  const d = (desc * size) / 100;
  const base = bandTop + (bandH - (a + d)) / 2 + a;
  const x = W / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(5,3,26,0.55)';
  ctx.shadowBlur = size * 0.1;
  ctx.shadowOffsetY = size * 0.06;
  ctx.strokeStyle = PAL.night;
  ctx.lineWidth = size * 0.17;
  ctx.strokeText(name, x, base + size * 0.03);
  ctx.restore();
  ctx.strokeStyle = '#7a4c10';
  ctx.lineWidth = size * 0.06;
  ctx.strokeText(name, x, base + size * 0.035);
  ctx.fillStyle = '#7a4c10';
  ctx.fillText(name, x, base + size * 0.05);
  // glossy two-tone gold: a bright upper face meeting a deeper lower face along a soft bevel line
  ctx.fillStyle = lGrad(ctx, 0, base - a, 0, base + d, [
    [0, '#fffdf0'],
    [0.3, '#ffe68f'],
    [0.5, '#ffd25c'],
    [0.56, '#f6b93e'],
    [1, '#e0902a'],
  ]);
  ctx.fillText(name, x, base);


  // tagline with flanking ornaments
  const ts = W * 0.068;
  ctx.font = '600 ' + ts.toFixed(2) + 'px ' + LOGO_FONT;
  const ty = W * 0.853;
  const tw = ctx.measureText(tagline).width;
  ctx.strokeStyle = rgba(PAL.night, 0.85);
  ctx.lineWidth = ts * 0.22;
  ctx.strokeText(tagline, x, ty);
  ctx.fillStyle = PAL.cream;
  ctx.fillText(tagline, x, ty);
  const gap = ts * 0.55;
  const rule = Math.min(W * 0.11, (W - tw) / 2 - gap - ts * 0.6);
  if (rule > ts * 0.5) {
    const oy = ty - ts * 0.33;
    ornament(ctx, x - tw / 2 - gap, x - tw / 2 - gap - rule, oy, ts);
    ornament(ctx, x + tw / 2 + gap, x + tw / 2 + gap + rule, oy, ts);
  }
  ctx.restore();
}
