/**
 * Chapter backdrops: six layered night scenes painted once per screen size.
 * Deterministic (seeded PRNG, never Math.random) and cheap: gradients and paths only — no blur
 * filters, no per-pixel work — so a 1440×3120 paint stays fast on a phone.
 *
 * `u` below is 1% of the shorter screen side; every size is expressed in it so the scenes keep
 * their proportions from 320×480 up to tablets, portrait or landscape.
 */
import type { ChapterTheme, ThemePalette } from './types.ts';
import type { Ctx } from './util.ts';
import { TAU, glow, hashStr, khatam, lGrad, mulberry32, rgba, sparkle, vGrad } from './util.ts';

type Rnd = () => number;

export const PALETTES: Record<ChapterTheme, ThemePalette> = {
  oasis: { bgTop: '#2c3c9a', bgBottom: '#1b648e', accent: '#4fd8c0', frame: '#f5c95a' },
  dunes: { bgTop: '#8f2f3e', bgBottom: '#531c2c', accent: '#ffb347', frame: '#ffd27a' },
  bazaar: { bgTop: '#3b1766', bgBottom: '#33103f', accent: '#ff8f6a', frame: '#ffcf70' },
  palace: { bgTop: '#141a6a', bgBottom: '#121c56', accent: '#7fe0d6', frame: '#ffe7a3' },
  caverns: { bgTop: '#0b1d44', bgBottom: '#0b1d44', accent: '#5fe6e0', frame: '#f0d98a' },
  stars: { bgTop: '#070620', bgBottom: '#2a1a68', accent: '#8fb8ff', frame: '#ffe7a3' },
};

// ───────────────────────────── shared pieces ─────────────────────────────

function fillV(ctx: Ctx, w: number, y0: number, y1: number, stops: readonly (readonly [number, string])[]): void {
  ctx.fillStyle = vGrad(ctx, y0, y1, stops);
  ctx.fillRect(0, y0, w, y1 - y0);
}

function starField(ctx: Ctx, rnd: Rnd, w: number, y0: number, y1: number, count: number, u: number, tint: string): void {
  ctx.fillStyle = tint;
  for (let i = 0; i < count; i++) {
    const x = rnd() * w;
    const t = rnd();
    const y = y0 + t * (y1 - y0);
    const r = (0.1 + rnd() * rnd() * 0.42) * u;
    ctx.globalAlpha = (0.3 + rnd() * 0.7) * (1 - t * 0.55);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function twinkles(ctx: Ctx, rnd: Rnd, w: number, y0: number, y1: number, count: number, u: number, tint: string): void {
  for (let i = 0; i < count; i++) {
    const x = rnd() * w;
    const y = y0 + rnd() * (y1 - y0);
    const r = (0.9 + rnd() * 1.3) * u;
    glow(ctx, x, y, r * 2.2, tint, 0.3);
    ctx.fillStyle = tint;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    sparkle(ctx, x, y, r, 0.14);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

const RIDGE_N = 96;

/** Smooth rolling skyline: RIDGE_N + 1 heights across the width. */
function ridge(rnd: Rnd, w: number, base: number, amp: number, waves: number): number[] {
  const p1 = rnd() * TAU;
  const p2 = rnd() * TAU;
  const p3 = rnd() * TAU;
  const f = (waves * TAU) / w;
  const ys: number[] = [];
  for (let i = 0; i <= RIDGE_N; i++) {
    const x = (i / RIDGE_N) * w;
    ys.push(base - amp * (0.62 * Math.sin(x * f + p1) + 0.28 * Math.sin(x * f * 2.3 + p2) + 0.1 * Math.sin(x * f * 5.3 + p3)));
  }
  return ys;
}

function ridgePath(ctx: Ctx, ys: readonly number[], w: number, bottom: number): void {
  ctx.beginPath();
  ctx.moveTo(0, bottom);
  for (let i = 0; i <= RIDGE_N; i++) ctx.lineTo((i / RIDGE_N) * w, ys[i]);
  ctx.lineTo(w, bottom);
  ctx.closePath();
}

function ridgeLine(ctx: Ctx, ys: readonly number[], w: number): void {
  ctx.beginPath();
  for (let i = 0; i <= RIDGE_N; i++) {
    const x = (i / RIDGE_N) * w;
    if (i === 0) ctx.moveTo(x, ys[i]);
    else ctx.lineTo(x, ys[i]);
  }
}

function ridgeAt(ys: readonly number[], w: number, x: number): number {
  const t = Math.max(0, Math.min(RIDGE_N, (x / w) * RIDGE_N));
  const i = Math.min(RIDGE_N - 1, Math.floor(t));
  return ys[i] + (ys[i + 1] - ys[i]) * (t - i);
}

/** Palm silhouette: curved tapering trunk and a crown of drooping, serrated fronds. */
function palm(ctx: Ctx, rnd: Rnd, x: number, y: number, hgt: number, lean: number, fill: string, rim: string): void {
  const topX = x + lean;
  const topY = y - hgt;
  const cxp = x + lean * 0.15;
  const cyp = y - hgt * 0.55;
  const wb = hgt * 0.05;
  const wt = hgt * 0.024;
  const N = 14;
  const lx: number[] = [];
  const ly: number[] = [];
  const rx: number[] = [];
  const ry: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    const px = a * x + b * cxp + c * topX;
    const py = a * y + b * cyp + c * topY;
    const dx = 2 * (1 - t) * (cxp - x) + 2 * t * (topX - cxp);
    const dy = 2 * (1 - t) * (cyp - y) + 2 * t * (topY - cyp);
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const wd = wb + (wt - wb) * t;
    lx.push(px - (dy / d) * wd);
    ly.push(py + (dx / d) * wd);
    rx.push(px + (dy / d) * wd);
    ry.push(py - (dx / d) * wd);
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(lx[0], ly[0]);
  for (let i = 1; i <= N; i++) ctx.lineTo(lx[i], ly[i]);
  for (let i = N; i >= 0; i--) ctx.lineTo(rx[i], ry[i]);
  ctx.closePath();
  ctx.fill();
  // moonlit edge
  ctx.strokeStyle = rim;
  ctx.lineWidth = Math.max(1, hgt * 0.008);
  ctx.beginPath();
  ctx.moveTo(rx[0], ry[0]);
  for (let i = 1; i <= N; i++) ctx.lineTo(rx[i], ry[i]);
  ctx.stroke();

  // fronds: an arching spine with swept leaflets on both sides (longer on the underside)
  const n = 8;
  const M = 9;
  const ux: number[] = [];
  const uy: number[] = [];
  const dxs: number[] = [];
  const dys: number[] = [];
  for (let k = 0; k < n; k++) {
    // two fans (left and right) so no frond stands straight up
    const half = n / 2;
    const a =
      (k < half ? -Math.PI * 1.1 + (k / (half - 1)) * Math.PI * 0.5 : -Math.PI * 0.4 + ((k - half) / (half - 1)) * Math.PI * 0.5) + (rnd() - 0.5) * 0.1;
    const len = hgt * (0.4 + rnd() * 0.14);
    const ex = topX + Math.cos(a) * len;
    const ey = topY + Math.sin(a) * len * 0.62 + len * 0.36;
    const mx = topX + Math.cos(a) * len * 0.55;
    const my = topY + Math.sin(a) * len * 0.62 - len * 0.2;
    const outward = Math.cos(a) >= 0;
    ux.length = 0;
    uy.length = 0;
    dxs.length = 0;
    dys.length = 0;
    for (let j = 0; j <= M * 2; j++) {
      const t = j / (M * 2);
      const qa = (1 - t) * (1 - t);
      const qb = 2 * (1 - t) * t;
      const qc = t * t;
      const px = qa * topX + qb * mx + qc * ex;
      const py = qa * topY + qb * my + qc * ey;
      let tx = 2 * (1 - t) * (mx - topX) + 2 * t * (ex - mx);
      let ty = 2 * (1 - t) * (my - topY) + 2 * t * (ey - my);
      const tl = Math.sqrt(tx * tx + ty * ty) || 1;
      tx /= tl;
      ty /= tl;
      // leaflets hang from the outer / under side: fixed per frond so the outline never folds over
      const nx = outward ? -ty : ty;
      const ny = outward ? tx : -tx;
      const taper = Math.sin(Math.PI * Math.pow(t, 0.75)) * (1 - t * 0.25);
      const tipOut = j % 2 === 1 ? 1 : 0.34;
      const lu = len * 0.014;
      const ld = len * 0.23 * taper * tipOut + len * 0.012;
      ux.push(px - nx * lu);
      uy.push(py - ny * lu);
      dxs.push(px + nx * ld + tx * ld * 0.45);
      dys.push(py + ny * ld + ty * ld * 0.45 + ld * 0.25);
    }
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    for (let j = 1; j <= M * 2; j++) ctx.lineTo(ux[j], uy[j]);
    ctx.lineTo(ex, ey);
    for (let j = M * 2; j >= 1; j--) ctx.lineTo(dxs[j], dys[j]);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rim;
    ctx.lineWidth = Math.max(1, hgt * 0.006);
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.stroke();
  }
  // crown knot
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(topX, topY, hgt * 0.035, 0, TAU);
  ctx.fill();
}

function onionDome(ctx: Ctx, cx: number, baseY: number, half: number, hgt: number): void {
  ctx.moveTo(cx - half * 0.8, baseY);
  ctx.bezierCurveTo(cx - half * 1.28, baseY - hgt * 0.34, cx - half * 0.8, baseY - hgt * 0.74, cx - half * 0.13, baseY - hgt * 0.92);
  ctx.quadraticCurveTo(cx - half * 0.02, baseY - hgt * 0.98, cx, baseY - hgt * 1.16);
  ctx.quadraticCurveTo(cx + half * 0.02, baseY - hgt * 0.98, cx + half * 0.13, baseY - hgt * 0.92);
  ctx.bezierCurveTo(cx + half * 0.8, baseY - hgt * 0.74, cx + half * 1.28, baseY - hgt * 0.34, cx + half * 0.8, baseY);
  ctx.closePath();
}

/** Spire finial for domes and towers: a stem with two beads and a point. */
function finial(ctx: Ctx, cx: number, y: number, s: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(cx - s * 0.09, y - s * 2.5, s * 0.18, s * 2.6);
  ctx.beginPath();
  ctx.arc(cx, y - s * 0.75, s * 0.42, 0, TAU);
  ctx.arc(cx, y - s * 1.55, s * 0.3, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.2, y - s * 2.3);
  ctx.lineTo(cx, y - s * 3.3);
  ctx.lineTo(cx + s * 0.2, y - s * 2.3);
  ctx.closePath();
  ctx.fill();
}

/** Pointed-arch window / doorway path. */
function archPath(ctx: Ctx, cx: number, bottom: number, half: number, hgt: number): void {
  const spring = bottom - hgt * 0.55;
  ctx.moveTo(cx - half, bottom);
  ctx.lineTo(cx - half, spring);
  ctx.quadraticCurveTo(cx - half, bottom - hgt * 0.9, cx, bottom - hgt);
  ctx.quadraticCurveTo(cx + half, bottom - hgt * 0.9, cx + half, spring);
  ctx.lineTo(cx + half, bottom);
  ctx.closePath();
}

// ───────────────────────────── oasis ─────────────────────────────

/** Long, thin cloud bar with a soft lens shape. */
function cloudBar(ctx: Ctx, cx: number, cy: number, cw: number, ch: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - cw / 2, cy);
  ctx.quadraticCurveTo(cx - cw * 0.1, cy - ch * 2, cx + cw / 2, cy);
  ctx.quadraticCurveTo(cx + cw * 0.1, cy + ch, cx - cw / 2, cy);
  ctx.fill();
}

// Chapter 1 — the oasis at dawn: periwinkle sky warming to peach, a pale morning moon, the sun
// coming up behind the far bank, turquoise water and green palms.
function oasis(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  const u = Math.min(w, h) / 100;
  const hz = h * 0.6;
  fillV(ctx, w, 0, hz + 1, [
    [0, '#2c3c9a'],
    [0.26, '#5560c6'],
    [0.5, '#9d7dd2'],
    [0.7, '#ee97b2'],
    [0.87, '#ffc39a'],
    [1, '#ffe7b0'],
  ]);
  // the last stars of the night, only in the highest, darkest part of the sky
  starField(ctx, rnd, w, 0, hz * 0.42, 70, u, '#ffffff');
  twinkles(ctx, rnd, w * 0.6, h * 0.015, hz * 0.3, 4, u, '#fff6e6');

  // pale morning moon
  const mx = w * 0.74;
  const my = h * 0.13;
  const mr = 6.4 * u;
  glow(ctx, mx, my, mr * 3.4, '#ffffff', 0.2);
  const moon = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.35, mr * 0.1, mx, my, mr);
  moon.addColorStop(0, '#ffffff');
  moon.addColorStop(0.75, '#e6e2fb');
  moon.addColorStop(1, '#c2bdf0');
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(150,140,220,0.2)';
  const craters = [0.3, -0.2, 0.2, -0.25, 0.3, 0.26, 0.1, 0.5, 0.13, 0.42, -0.42, 0.1];
  for (let i = 0; i < craters.length; i += 3) {
    ctx.beginPath();
    ctx.arc(mx + craters[i] * mr, my + craters[i + 1] * mr, craters[i + 2] * mr, 0, TAU);
    ctx.fill();
  }

  // the sun, half risen behind the far bank
  const sx = w * 0.52;
  const sy = hz - 1.2 * u;
  glow(ctx, sx, sy, 70 * u, '#ffd29a', 0.55);
  glow(ctx, sx, sy, 28 * u, '#fff4cc', 0.75);
  const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, 9 * u);
  sun.addColorStop(0, '#ffffff');
  sun.addColorStop(0.7, '#fff3c4');
  sun.addColorStop(1, '#ffdf96');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sx, sy, 9 * u, 0, TAU);
  ctx.fill();

  // thin clouds catching the first light from below
  for (let i = 0; i < 7; i++) {
    const cy = hz * (0.46 + rnd() * 0.44);
    const warm = cy > hz * 0.7;
    cloudBar(ctx, rnd() * w, cy, (24 + rnd() * 40) * u, (0.7 + rnd() * 1.1) * u, warm ? 'rgba(255,236,200,0.55)' : 'rgba(255,190,210,0.4)');
  }
  // a few birds heading out over the water
  ctx.strokeStyle = 'rgba(70,50,120,0.6)';
  ctx.lineWidth = Math.max(1, 0.26 * u);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < 4; i++) {
    const bx = w * (0.52 + i * 0.07) + (rnd() - 0.5) * 3 * u;
    const by = hz * (0.63 + (i % 2) * 0.05) + (rnd() - 0.5) * 2 * u;
    const bs = (1.3 + rnd() * 0.7) * u;
    ctx.beginPath();
    ctx.moveTo(bx - bs, by - bs * 0.25);
    ctx.quadraticCurveTo(bx - bs * 0.4, by - bs * 0.7, bx, by);
    ctx.quadraticCurveTo(bx + bs * 0.4, by - bs * 0.7, bx + bs, by - bs * 0.25);
    ctx.stroke();
  }

  // far dunes with tiny palms
  const far = ridge(rnd, w, hz - 2.5 * u, 3.2 * u, 1.4);
  ridgePath(ctx, far, w, hz + 4 * u);
  ctx.fillStyle = vGrad(ctx, hz - 6 * u, hz + 2, [
    [0, '#d28fa6'],
    [1, '#b97a9e'],
  ]);
  ctx.fill();
  ridgeLine(ctx, far, w);
  ctx.strokeStyle = 'rgba(255,236,200,0.6)';
  ctx.lineWidth = Math.max(1, 0.24 * u);
  ctx.stroke();
  const mid = ridge(rnd, w, hz + 0.4 * u, 2.2 * u, 2.1);
  for (let i = 0; i < 5; i++) {
    const px = (0.08 + i * 0.2 + rnd() * 0.08) * w;
    palm(ctx, rnd, px, ridgeAt(mid, w, px) + u, (6 + rnd() * 5) * u, (rnd() - 0.5) * 3 * u, '#6c4c8c', 'rgba(255,214,170,0.4)');
  }
  ridgePath(ctx, mid, w, hz + 3 * u);
  ctx.fillStyle = '#9a6696';
  ctx.fill();

  // water
  const top = hz + 1.6 * u;
  fillV(ctx, w, top, h, [
    [0, '#ffd6a6'],
    [0.07, '#bfe0c6'],
    [0.26, '#59c6c2'],
    [0.6, '#2796ac'],
    [1, '#1b648e'],
  ]);
  // bright shoreline where the far bank meets the water
  ctx.fillStyle = 'rgba(255,248,220,0.7)';
  ctx.fillRect(0, top - 0.12 * u, w, Math.max(1, 0.26 * u));
  // the sun's path on the water
  for (let i = 0; i < 46; i++) {
    const t = i / 46;
    const y = top + Math.pow(t, 1.35) * (h - top) * 0.8 + u * 0.4;
    const ww = (2.6 + t * 24) * u * (0.45 + rnd() * 0.75);
    const x = sx + (rnd() - 0.5) * u * (2 + t * 16);
    ctx.fillStyle = 'rgba(255,246,206,' + (0.7 * (1 - t) * (0.5 + rnd() * 0.5)).toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(x, y, ww / 2, (0.16 + t * 0.26) * u, 0, 0, TAU);
    ctx.fill();
  }
  // ripples
  for (let i = 0; i < 70; i++) {
    const t = rnd();
    const y = top + t * (h - top);
    const ww = (2 + rnd() * 9) * u * (0.5 + t);
    ctx.fillStyle = 'rgba(220,255,250,' + (0.06 + rnd() * 0.12).toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(rnd() * w, y, ww / 2, (0.12 + t * 0.14) * u, 0, 0, TAU);
    ctx.fill();
  }

  // near banks: deep green, still in the shade of the morning
  ctx.fillStyle = lGrad(ctx, 0, h * 0.74, 0, h, [
    [0, '#1f6a54'],
    [0.4, '#16503f' ],
    [1, '#0d3530'],
  ]);
  ctx.beginPath();
  ctx.moveTo(0, h * 0.775);
  ctx.bezierCurveTo(w * 0.16, h * 0.79, w * 0.3, h * 0.86, w * 0.4, h * 0.935);
  ctx.bezierCurveTo(w * 0.46, h * 0.975, w * 0.52, h * 0.99, w * 0.6, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w, h * 0.815);
  ctx.bezierCurveTo(w * 0.9, h * 0.825, w * 0.8, h * 0.89, w * 0.72, h * 0.95);
  ctx.bezierCurveTo(w * 0.68, h * 0.98, w * 0.64, h * 0.995, w * 0.56, h);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  // first light along the top of each bank
  ctx.strokeStyle = 'rgba(190,240,170,0.5)';
  ctx.lineWidth = Math.max(1, 0.3 * u);
  ctx.beginPath();
  ctx.moveTo(0, h * 0.775);
  ctx.bezierCurveTo(w * 0.16, h * 0.79, w * 0.3, h * 0.86, w * 0.4, h * 0.935);
  ctx.moveTo(w, h * 0.815);
  ctx.bezierCurveTo(w * 0.9, h * 0.825, w * 0.8, h * 0.89, w * 0.72, h * 0.95);
  ctx.stroke();
  // reeds
  ctx.strokeStyle = '#124a3c';
  ctx.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const left = i % 2 === 0;
    const t = rnd();
    const bx = left ? t * w * 0.42 : w - t * w * 0.3;
    const by = left ? h * (0.785 + t * 0.165) : h * (0.825 + t * 0.14);
    const len = (2.5 + rnd() * 5.5) * u;
    ctx.lineWidth = Math.max(1, (0.2 + rnd() * 0.22) * u);
    ctx.beginPath();
    ctx.moveTo(bx, by + u);
    ctx.quadraticCurveTo(bx + (rnd() - 0.5) * u, by - len * 0.5, bx + (rnd() - 0.5) * 3.4 * u, by - len);
    ctx.stroke();
  }
  const rim = 'rgba(214,246,160,0.5)';
  palm(ctx, rnd, w * 0.2, h * 0.86, 30 * u, -5 * u, '#17604a', rim);
  palm(ctx, rnd, w * 0.1, h * 0.82, 47 * u, 9 * u, '#13523f', rim);
  palm(ctx, rnd, w * 0.91, h * 0.85, 39 * u, -9 * u, '#13523f', rim);
  // glints of light on the water
  for (let i = 0; i < 14; i++) {
    const x = w * (0.3 + rnd() * 0.42);
    const y = top + (0.08 + rnd() * 0.8) * (h - top);
    const r = (0.5 + rnd() * 0.8) * u;
    glow(ctx, x, y, r * 2.6, '#fff8dc', 0.4);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    sparkle(ctx, x, y, r, 0.16);
    ctx.fill();
  }
}

/** One camel, facing right, standing on (x, y); `s` = its length. */
function camel(ctx: Ctx, x: number, y: number, s: number): void {
  const k = s / 10;
  const X = (v: number): number => x + v * k;
  const Y = (v: number): number => y - (8 - v) * k;
  ctx.beginPath();
  ctx.moveTo(X(1.1), Y(8));
  ctx.lineTo(X(1.5), Y(4.7));
  ctx.quadraticCurveTo(X(0.9), Y(3.5), X(1.9), Y(2.9));
  ctx.quadraticCurveTo(X(3.2), Y(2.6), X(3.7), Y(1.3));
  ctx.quadraticCurveTo(X(4.4), Y(0.2), X(5.2), Y(1.4));
  ctx.quadraticCurveTo(X(5.8), Y(2.6), X(6.6), Y(2.9));
  ctx.quadraticCurveTo(X(7.3), Y(3), X(7.6), Y(1.9));
  ctx.lineTo(X(7.9), Y(0.7));
  ctx.quadraticCurveTo(X(8.2), Y(-0.1), X(9), Y(0.1));
  ctx.lineTo(X(9.8), Y(0.7));
  ctx.lineTo(X(9.6), Y(1.2));
  ctx.lineTo(X(8.8), Y(1.2));
  ctx.quadraticCurveTo(X(8.6), Y(2.8), X(8.1), Y(3.8));
  ctx.quadraticCurveTo(X(7.7), Y(4.6), X(7.3), Y(4.8));
  ctx.lineTo(X(7.6), Y(8));
  ctx.lineTo(X(7.1), Y(8));
  ctx.lineTo(X(6.7), Y(5.3));
  ctx.lineTo(X(6.2), Y(8));
  ctx.lineTo(X(5.7), Y(8));
  ctx.lineTo(X(5.9), Y(5.1));
  ctx.lineTo(X(3.2), Y(5.1));
  ctx.lineTo(X(3), Y(8));
  ctx.lineTo(X(2.5), Y(8));
  ctx.lineTo(X(2.3), Y(5.4));
  ctx.lineTo(X(1.7), Y(8));
  ctx.closePath();
  ctx.fill();
}

/** A tiny caravan crossing a ridge towards the sun. */
function caravan(ctx: Ctx, ys: readonly number[], w: number, u: number): void {
  ctx.fillStyle = '#5c1f2a';
  ctx.strokeStyle = '#5c1f2a';
  const s = 5.4 * u;
  let px = 0;
  let py = 0;
  for (let i = 0; i < 3; i++) {
    const x = w * 0.5 + i * s * 1.5;
    const y = ridgeAt(ys, w, x + s * 0.5) + 0.25 * u;
    camel(ctx, x, y, s);
    if (i > 0) {
      // lead rope: from the tail of the camel in front to this one's muzzle
      ctx.lineWidth = Math.max(1, 0.14 * u);
      ctx.beginPath();
      ctx.moveTo(px + s * 0.12, py - s * 0.5);
      ctx.quadraticCurveTo((px + x) / 2 + s * 0.5, (py + y) / 2 - s * 0.2, x + s * 0.94, y - s * 0.68);
      ctx.stroke();
    }
    px = x;
    py = y;
  }
}

// ───────────────────────────── dunes ─────────────────────────────

// Chapter 2 — the dunes at golden hour: a hot amber sky, a huge low sun, and sand that runs from
// molten gold on the far crests to deep sienna and wine in the near shadows.
function dunes(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  const u = Math.min(w, h) / 100;
  const hz = h * 0.5;
  fillV(ctx, w, 0, hz + 2, [
    [0, '#8f2f3e'],
    [0.26, '#c44a38'],
    [0.52, '#ee7d33'],
    [0.76, '#ffb347'],
    [0.92, '#ffd876'],
    [1, '#ffeba4'],
  ]);

  // sun sinking towards the far ridge
  const sx = w * 0.3;
  const sy = hz - 4 * u;
  glow(ctx, sx, sy, 78 * u, '#ffe08a', 0.6);
  glow(ctx, sx, sy, 34 * u, '#fff6c8', 0.75);
  const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, 12.5 * u);
  sun.addColorStop(0, '#ffffff');
  sun.addColorStop(0.75, '#fff6cc');
  sun.addColorStop(1, '#ffe89a');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sx, sy, 12.5 * u, 0, TAU);
  ctx.fill();

  // long thin clouds, dark against the upper sky and glowing near the sun
  for (let i = 0; i < 8; i++) {
    const cy = hz * (0.2 + rnd() * 0.68);
    const warm = cy > hz * 0.6;
    cloudBar(ctx, rnd() * w, cy, (22 + rnd() * 44) * u, (0.7 + rnd() * 1.2) * u, warm ? 'rgba(255,240,190,0.5)' : 'rgba(120,32,52,0.42)');
  }
  // heat shimmer: a few motes of dust catching the light
  for (let i = 0; i < 22; i++) {
    const x = rnd() * w;
    const y = hz * (0.5 + rnd() * 0.46);
    const r = (0.14 + rnd() * 0.26) * u;
    ctx.fillStyle = 'rgba(255,250,220,' + (0.2 + rnd() * 0.4).toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  ctx.fillStyle = '#ffd876';
  ctx.fillRect(0, hz, w, h - hz);
  const span = h - hz;
  // [start, amplitude, waves, lit colour, shade colour, crest highlight alpha]
  const layers: [number, number, number, string, string, number][] = [
    [0, 2.6, 1.3, '#ffc85a', '#f39a3e', 0.85],
    [0.11, 5.2, 1.1, '#f9a53e', '#de6f30', 0.75],
    [0.29, 7.4, 0.9, '#e6782f', '#b84a2c', 0.6],
    [0.52, 9.5, 0.75, '#bd4f2d', '#84302e', 0.45],
    [0.79, 8.5, 0.6, '#84302e', '#531c2c', 0.34],
  ];
  for (let li = 0; li < layers.length; li++) {
    const L = layers[li];
    const base = hz + span * L[0];
    const ys = ridge(rnd, w, base, L[1] * u, L[2] * (0.8 + rnd() * 0.5));
    ctx.save();
    ridgePath(ctx, ys, w, h + 2);
    ctx.clip();
    ctx.fillStyle = vGrad(ctx, base - L[1] * u, base + span * 0.34, [
      [0, L[3]],
      [1, L[4]],
    ]);
    ctx.fillRect(0, base - L[1] * u - 2, w, h - base + L[1] * u + 4);
    // slip faces: the shaded lee side below each crest
    let found = 0;
    for (let i = 3; i < RIDGE_N - 3 && found < 3; i++) {
      if (ys[i] < ys[i - 1] && ys[i] <= ys[i + 1] && ys[i] < ys[i - 3] - 0.2 * u) {
        found++;
        const x0 = (i / RIDGE_N) * w;
        const y0 = ys[i];
        const sw = (30 + li * 10) * u;
        const sh = (14 + li * 6) * u;
        const g = ctx.createLinearGradient(x0, 0, x0 + sw, 0);
        g.addColorStop(0, 'rgba(96,22,34,0.46)');
        g.addColorStop(0.55, 'rgba(96,22,34,0.18)');
        g.addColorStop(1, 'rgba(96,22,34,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x0, y0 - u);
        // the crest line sweeps down and away from the peak, then runs off the layer
        ctx.bezierCurveTo(x0 + sw * 0.05, y0 + sh * 0.35, x0 + sw * 0.22, y0 + sh * 0.5, x0 + sw * 0.3, y0 + sh);
        ctx.bezierCurveTo(x0 + sw * 0.36, y0 + sh * 1.4, x0 + sw * 0.44, y0 + sh * 2.2, x0 + sw * 0.46, h + 2);
        ctx.lineTo(x0 + sw, h + 2);
        ctx.lineTo(x0 + sw, y0 - L[1] * u * 2);
        ctx.closePath();
        ctx.fill();
        i += 8;
      }
    }
    // wind ripples on the nearest dunes
    if (li >= 3) {
      ctx.strokeStyle = 'rgba(255,206,140,0.1)';
      ctx.lineWidth = Math.max(1, 0.2 * u);
      for (let k = 0; k < 9; k++) {
        const yy = base + (k + 1) * 2.6 * u;
        ctx.beginPath();
        for (let q = 0; q <= 24; q++) {
          const x = (q / 24) * w;
          const y = yy + Math.sin(q * 0.9 + k) * u * 0.9 + (ridgeAt(ys, w, x) - base) * 0.7;
          if (q === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
    ridgeLine(ctx, ys, w);
    ctx.strokeStyle = 'rgba(255,240,190,' + L[5] + ')';
    ctx.lineWidth = Math.max(1, 0.3 * u);
    ctx.stroke();
    if (li === 1) caravan(ctx, ys, w, u);
  }
}

// ───────────────────────────── bazaar ─────────────────────────────

function lantern(ctx: Ctx, x: number, top: number, drop: number, s: number, glass: string, hot: string): void {
  const y0 = top + drop;
  // cord
  ctx.strokeStyle = 'rgba(36,12,52,0.9)';
  ctx.lineWidth = Math.max(1, s * 0.07);
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, y0);
  ctx.stroke();
  glow(ctx, x, y0 + s * 0.95, s * 4.2, glass, 0.34);
  glow(ctx, x, y0 + s * 0.95, s * 1.8, hot, 0.5);
  // cap
  ctx.fillStyle = '#120a2a';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.16, y0);
  ctx.lineTo(x + s * 0.16, y0);
  ctx.lineTo(x + s * 0.42, y0 + s * 0.32);
  ctx.lineTo(x - s * 0.42, y0 + s * 0.32);
  ctx.closePath();
  ctx.fill();
  // glass body
  const by = y0 + s * 0.3;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.36, by);
  ctx.bezierCurveTo(x - s * 0.95, by + s * 0.35, x - s * 0.8, by + s * 1.05, x - s * 0.28, by + s * 1.4);
  ctx.lineTo(x + s * 0.28, by + s * 1.4);
  ctx.bezierCurveTo(x + s * 0.8, by + s * 1.05, x + s * 0.95, by + s * 0.35, x + s * 0.36, by);
  ctx.closePath();
  const g = ctx.createRadialGradient(x, by + s * 0.72, s * 0.05, x, by + s * 0.72, s * 0.9);
  g.addColorStop(0, '#fffbe2');
  g.addColorStop(0.45, hot);
  g.addColorStop(1, glass);
  ctx.fillStyle = g;
  ctx.fill();
  // ribs
  ctx.strokeStyle = 'rgba(18,10,42,0.85)';
  ctx.lineWidth = Math.max(1, s * 0.07);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, by);
  ctx.lineTo(x, by + s * 1.4);
  ctx.moveTo(x - s * 0.2, by);
  ctx.bezierCurveTo(x - s * 0.5, by + s * 0.4, x - s * 0.45, by + s * 1.0, x - s * 0.15, by + s * 1.4);
  ctx.moveTo(x + s * 0.2, by);
  ctx.bezierCurveTo(x + s * 0.5, by + s * 0.4, x + s * 0.45, by + s * 1.0, x + s * 0.15, by + s * 1.4);
  ctx.stroke();
  // base and tassel
  ctx.fillStyle = '#120a2a';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.34, by + s * 1.38);
  ctx.lineTo(x + s * 0.34, by + s * 1.38);
  ctx.lineTo(x + s * 0.12, by + s * 1.66);
  ctx.lineTo(x - s * 0.12, by + s * 1.66);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = hot;
  ctx.beginPath();
  ctx.moveTo(x, by + s * 1.66);
  ctx.lineTo(x + s * 0.09, by + s * 2.1);
  ctx.lineTo(x, by + s * 2.3);
  ctx.lineTo(x - s * 0.09, by + s * 2.1);
  ctx.closePath();
  ctx.fill();
}

function skyline(ctx: Ctx, rnd: Rnd, w: number, base: number, bottom: number, u: number, wall: string, lit: string, litAlpha: number): void {
  // solid footing so no gap ever shows between two buildings
  ctx.fillStyle = wall;
  ctx.fillRect(0, base - 6 * u, w, bottom - base + 6 * u);
  let x = -rnd() * 6 * u;
  while (x < w) {
    const bw = (9 + rnd() * 12) * u;
    const bh = (7 + rnd() * 16) * u;
    const top = base - bh;
    ctx.fillStyle = wall;
    ctx.fillRect(x, top, bw + 1, bottom - top);
    const kind = rnd();
    if (kind < 0.36) {
      // dome on the roof with a small spire
      ctx.beginPath();
      onionDome(ctx, x + bw / 2, top + 0.3 * u, bw * 0.3, bw * 0.36);
      ctx.fill();
      ctx.fillRect(x + bw / 2 - 0.12 * u, top - bw * 0.36 * 1.16 - 1.6 * u, 0.24 * u, 2 * u);
    } else if (kind < 0.66) {
      // crenellations
      const n = Math.max(3, Math.floor(bw / (2.2 * u)));
      for (let i = 0; i < n; i++) if (i % 2 === 0) ctx.fillRect(x + (i / n) * bw, top - 1.1 * u, bw / n + 0.5, 1.2 * u);
    } else if (kind < 0.86) {
      // wind tower
      const tw = bw * 0.22;
      const tx = x + bw * (0.2 + rnd() * 0.5);
      ctx.fillRect(tx, top - 5 * u, tw, 5.2 * u);
      ctx.fillRect(tx - 0.3 * u, top - 5.5 * u, tw + 0.6 * u, 0.7 * u);
    }
    // windows
    const cols = Math.max(1, Math.floor(bw / (4.2 * u)));
    const rows = Math.max(1, Math.floor(bh / (6 * u)));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rnd() < 0.4) continue;
        const wx = x + ((c + 0.5) / cols) * bw;
        const wy = top + 4.6 * u + r * 6 * u;
        ctx.fillStyle = rgba(lit, litAlpha * (0.5 + rnd() * 0.5));
        ctx.beginPath();
        archPath(ctx, wx, wy, 0.75 * u, 2.6 * u);
        ctx.fill();
      }
    }
    ctx.fillStyle = wall;
    x += bw - 0.4 * u;
  }
}

/** A market stall in a bottom corner: striped canopy with a scalloped valance, counter and jars. */
function stall(ctx: Ctx, w: number, h: number, u: number, side: number): void {
  const dir = side === 0 ? 1 : -1;
  const ax = side === 0 ? 0 : w;
  const aw = Math.min(w * 0.42, 38 * u);
  const top = h * 0.868;
  const slope = 3 * u;
  const depth = 4.6 * u;
  const X = (t: number): number => ax + dir * t * aw;
  const Yt = (t: number): number => top + t * slope;

  // warm light pooling under the canopy
  glow(ctx, X(0.5), top + 10.5 * u, 17 * u, '#ffbe6a', 0.55);
  // counter
  const cy = top + 13 * u;
  ctx.fillStyle = '#3a123c';
  ctx.fillRect(Math.min(X(0), X(0.9)), cy, aw * 0.9, h - cy + 1);
  ctx.fillStyle = 'rgba(255,200,120,0.5)';
  ctx.fillRect(Math.min(X(0), X(0.9)), cy, aw * 0.9, Math.max(1, 0.34 * u));
  // jars and a bowl on the counter
  ctx.fillStyle = '#2a0c30';
  const jars = [0.16, 3.2, 4.4, 0.36, 2.4, 3, 0.56, 3.6, 5.2, 0.76, 2.6, 2.4];
  for (let i = 0; i < jars.length; i += 3) {
    const jx = X(jars[i]);
    const jw = jars[i + 1] * u;
    const jh = jars[i + 2] * u;
    ctx.beginPath();
    ctx.moveTo(jx - jw * 0.3, cy);
    ctx.bezierCurveTo(jx - jw * 0.75, cy - jh * 0.3, jx - jw * 0.6, cy - jh * 0.8, jx - jw * 0.22, cy - jh * 0.86);
    ctx.lineTo(jx - jw * 0.3, cy - jh);
    ctx.lineTo(jx + jw * 0.3, cy - jh);
    ctx.lineTo(jx + jw * 0.22, cy - jh * 0.86);
    ctx.bezierCurveTo(jx + jw * 0.6, cy - jh * 0.8, jx + jw * 0.75, cy - jh * 0.3, jx + jw * 0.3, cy);
    ctx.closePath();
    ctx.fill();
  }
  // poles
  ctx.fillRect(X(0.9) - 0.3 * u, Yt(0.9) + depth * 0.5, 0.6 * u, cy - Yt(0.9));
  // canopy
  const stripes = 6;
  for (let i = 0; i < stripes; i++) {
    const t0 = i / stripes;
    const t1 = (i + 1) / stripes;
    ctx.fillStyle = i % 2 === 0 ? (side === 0 ? '#d8344e' : '#1fa39a') : '#ffe2a6';
    ctx.beginPath();
    ctx.moveTo(X(t0), Yt(t0));
    ctx.lineTo(X(t1), Yt(t1));
    ctx.lineTo(X(t1), Yt(t1) + depth);
    ctx.lineTo(X(t0), Yt(t0) + depth);
    ctx.closePath();
    ctx.fill();
    // valance scallop
    ctx.fillStyle = i % 2 === 0 ? (side === 0 ? '#a8223f' : '#147f7c') : '#e6bd7a';
    ctx.beginPath();
    ctx.moveTo(X(t0), Yt(t0) + depth - 0.5);
    ctx.lineTo(X(t1), Yt(t1) + depth - 0.5);
    ctx.bezierCurveTo(X(t1), Yt(t1) + depth + 3.4 * u, X(t0), Yt(t0) + depth + 3.4 * u, X(t0), Yt(t0) + depth - 0.5);
    ctx.fill();
  }
  // lit top edge of the canopy
  ctx.strokeStyle = 'rgba(255,240,200,0.75)';
  ctx.lineWidth = Math.max(1, 0.3 * u);
  ctx.beginPath();
  ctx.moveTo(X(0), Yt(0));
  ctx.lineTo(X(1), Yt(1));
  ctx.stroke();
}

// Chapter 3 — the bazaar at dusk, seen through a great arch: a violet-to-rose sky going orange over
// the rooftops, lit windows, strings of lights and glowing lanterns.
function bazaar(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  const u = Math.min(w, h) / 100;
  fillV(ctx, w, 0, h, [
    [0, '#2a1a70'],
    [0.18, '#5a2590'],
    [0.34, '#a23394'],
    [0.46, '#e2567c'],
    [0.55, '#ff9060'],
    [0.64, '#ffc878'],
    [0.8, '#ffb070'],
    [1, '#7a2a50'],
  ]);
  starField(ctx, rnd, w, 0, h * 0.34, 90, u, '#fff0e6');
  glow(ctx, w * 0.5, h * 0.72, 74 * u, '#ffb060', 0.42);
  // a few dusk clouds
  for (let i = 0; i < 5; i++) {
    const cy = h * (0.4 + rnd() * 0.22);
    cloudBar(ctx, rnd() * w, cy, (24 + rnd() * 36) * u, (0.8 + rnd() * 1.1) * u, cy > h * 0.52 ? 'rgba(255,226,170,0.5)' : 'rgba(255,150,170,0.34)');
  }

  // the town beyond the arch
  skyline(ctx, rnd, w, h * 0.66, h, u, '#8a3378', '#ffe08a', 0.9);
  skyline(ctx, rnd, w, h * 0.76, h, u, '#5c2163', '#ffd070', 1);
  // street: warm light spilling towards us between the houses
  fillV(ctx, w, h * 0.8, h, [
    [0, 'rgba(255,170,90,0)'],
    [0.3, 'rgba(255,150,80,0.26)'],
    [1, 'rgba(70,20,60,0.9)'],
  ]);
  ctx.fillStyle = lGrad(ctx, 0, h * 0.8, 0, h, [
    [0, 'rgba(255,206,130,0)'],
    [0.3, 'rgba(255,206,130,0.5)'],
    [1, 'rgba(255,180,110,0.1)'],
  ]);
  ctx.beginPath();
  ctx.moveTo(w * 0.485, h * 0.8);
  ctx.lineTo(w * 0.515, h * 0.8);
  ctx.lineTo(w * 0.76, h);
  ctx.lineTo(w * 0.24, h);
  ctx.closePath();
  ctx.fill();
  glow(ctx, w * 0.5, h * 0.83, 15 * u, '#ffe0a8', 0.55);

  // strings of little lights
  for (let s = 0; s < 3; s++) {
    const y0 = h * (0.2 + s * 0.085);
    const sag = (7 + s * 2.5) * u;
    const yL = y0 + (rnd() - 0.5) * 4 * u;
    const yR = y0 + (rnd() - 0.5) * 4 * u;
    ctx.strokeStyle = 'rgba(40,14,60,0.85)';
    ctx.lineWidth = Math.max(1, 0.18 * u);
    ctx.beginPath();
    ctx.moveTo(0, yL);
    ctx.quadraticCurveTo(w / 2, (yL + yR) / 2 + sag * 2, w, yR);
    ctx.stroke();
    const n = Math.round(w / (5.2 * u));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const bx = t * w;
      const by = (1 - t) * (1 - t) * yL + 2 * (1 - t) * t * ((yL + yR) / 2 + sag * 2) + t * t * yR + 0.5 * u;
      const col = i % 3 === 0 ? '#ff8fa0' : i % 3 === 1 ? '#ffd27a' : '#ffe9b8';
      glow(ctx, bx, by, 1.9 * u, col, 0.5);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(bx, by, 0.36 * u, 0, TAU);
      ctx.fill();
    }
  }

  // the great arch that frames the street
  const jamb = Math.max(7 * u, w * 0.085);
  const spring = h * 0.26;
  const apex = h * 0.035;
  const wall = lGrad(ctx, 0, 0, 0, h, [
    [0, '#3b1766'],
    [0.5, '#4a1a62'],
    [1, '#33103f'],
  ]);
  ctx.fillStyle = wall;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w, h);
  ctx.lineTo(w - jamb, h);
  ctx.lineTo(w - jamb, spring);
  ctx.bezierCurveTo(w - jamb, spring * 0.42, w * 0.66, apex + (spring - apex) * 0.2, w / 2, apex);
  ctx.bezierCurveTo(w * 0.34, apex + (spring - apex) * 0.2, jamb, spring * 0.42, jamb, spring);
  ctx.lineTo(jamb, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  // gold inlay following the arch
  for (let k = 0; k < 2; k++) {
    const o = (1 + k * 1.3) * u;
    ctx.strokeStyle = k === 0 ? 'rgba(255,214,110,0.85)' : 'rgba(255,214,110,0.4)';
    ctx.lineWidth = Math.max(1, (k === 0 ? 0.4 : 0.22) * u);
    ctx.beginPath();
    ctx.moveTo(jamb - o, h);
    ctx.lineTo(jamb - o, spring);
    ctx.bezierCurveTo(jamb - o, spring * 0.42 - o, w * 0.34, apex + (spring - apex) * 0.2 - o, w / 2, apex - o);
    ctx.bezierCurveTo(w * 0.66, apex + (spring - apex) * 0.2 - o, w - jamb + o, spring * 0.42 - o, w - jamb + o, spring);
    ctx.lineTo(w - jamb + o, h);
    ctx.stroke();
  }
  // khatam medallions in the spandrels and at the springing
  ctx.lineJoin = 'miter';
  const med = [w * 0.1, h * 0.06, 4.2, w * 0.9, h * 0.06, 4.2, jamb * 0.5, spring + 5 * u, 2.4, w - jamb * 0.5, spring + 5 * u, 2.4];
  for (let i = 0; i < med.length; i += 3) {
    ctx.strokeStyle = 'rgba(255,214,110,0.7)';
    ctx.lineWidth = Math.max(1, 0.3 * u);
    ctx.beginPath();
    khatam(ctx, med[i], med[i + 1], med[i + 2] * u, -Math.PI / 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,214,110,0.45)';
    ctx.beginPath();
    khatam(ctx, med[i], med[i + 1], med[i + 2] * u * 0.45, -Math.PI / 2);
    ctx.fill();
  }

  // hanging lanterns
  const hang: [number, number, number, string, string][] = [
    [0.2, 0.19, 5.4, '#e8552e', '#ffc45a'],
    [0.36, 0.09, 4.2, '#c9409a', '#ffb8d0'],
    [0.5, 0.045, 6.4, '#f0a020', '#ffe07a'],
    [0.65, 0.1, 4.4, '#2fb8b0', '#c9fff0'],
    [0.81, 0.2, 5.2, '#e8552e', '#ffc45a'],
  ];
  for (let i = 0; i < hang.length; i++) {
    const L = hang[i];
    const t = L[0];
    // where the cord leaves the underside of the arch
    const archY = apex + (spring - apex) * Math.pow(Math.abs(t - 0.5) * 2, 2.1) * 0.9;
    lantern(ctx, w * t, archY - u, h * L[1] + (rnd() - 0.5) * 2 * u, L[2] * u, L[3], L[4]);
  }

  stall(ctx, w, h, u, 0);
  stall(ctx, w, h, u, 1);
}

// ───────────────────────────── palace ─────────────────────────────

function lattice(ctx: Ctx, w: number, y0: number, y1: number, period: number, color: string, alphaTop: number): void {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, rgba(color, alphaTop));
  g.addColorStop(1, rgba(color, 0));
  ctx.strokeStyle = g;
  ctx.lineJoin = 'miter';
  ctx.lineWidth = Math.max(1, period * 0.022);
  const cols = Math.ceil(w / period) + 1;
  const rows = Math.ceil((y1 - y0) / period) + 1;
  const ox = (w - (cols - 1) * period) / 2;
  ctx.beginPath();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = ox + c * period;
      const y = y0 + r * period;
      khatam(ctx, x, y, period * 0.5, -Math.PI / 2);
      khatam(ctx, x, y, period * 0.2, -Math.PI / 2);
    }
  }
  ctx.stroke();
}

/** Palace watchtower: tapering shaft, crenellated platform, small cupola with its own dome colour. */
function tower(ctx: Ctx, cx: number, base: number, hgt: number, wd: number, wall: string | CanvasGradient, dome: string | CanvasGradient): void {
  const topY = base - hgt;
  ctx.fillStyle = wall;
  ctx.beginPath();
  ctx.moveTo(cx - wd * 0.62, base);
  ctx.lineTo(cx - wd * 0.46, topY);
  ctx.lineTo(cx + wd * 0.46, topY);
  ctx.lineTo(cx + wd * 0.62, base);
  ctx.closePath();
  // platform
  ctx.rect(cx - wd * 0.8, topY - wd * 0.25, wd * 1.6, wd * 0.5);
  // merlons
  for (let i = 0; i < 3; i++) ctx.rect(cx - wd * 0.8 + i * wd * 0.62, topY - wd * 0.62, wd * 0.36, wd * 0.4);
  // cupola drum
  ctx.rect(cx - wd * 0.34, topY - wd * 1.5, wd * 0.68, wd * 1.3);
  ctx.fill();
  ctx.fillStyle = dome;
  ctx.beginPath();
  onionDome(ctx, cx, topY - wd * 1.45, wd * 0.52, wd * 0.95);
  ctx.fill();
}

/** Turquoise dome glaze: lit from the upper left, deep on the far side. */
function domeGlaze(ctx: Ctx, cx: number, half: number): CanvasGradient {
  return lGrad(ctx, cx - half * 1.3, 0, cx + half * 1.3, 0, [
    [0, '#9ff5e6'],
    [0.3, '#3fd2c4'],
    [0.7, '#1f9aa6'],
    [1, '#14707f'],
  ]);
}

// Chapter 4 — the palace at twilight (the blue hour): royal-blue sky sinking through periwinkle to
// a rose horizon, turquoise domes, gold finials and lit windows, a lantern path through the garden.
function palace(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  const u = Math.min(w, h) / 100;
  const ground = h * 0.8;
  fillV(ctx, w, 0, h, [
    [0, '#141a6a'],
    [0.28, '#2638a4'],
    [0.5, '#5560d6'],
    [0.64, '#9c88ea'],
    [0.73, '#f0a4c8'],
    [0.8, '#ffd6b0'],
    [1, '#1a2a70'],
  ]);
  starField(ctx, rnd, w, 0, h * 0.46, 120, u, '#ffffff');
  lattice(ctx, w, 0, h * 0.42, Math.max(11 * u, w / 7), '#cfe0ff', 0.12);
  twinkles(ctx, rnd, w * 0.62, h * 0.2, h * 0.4, 3, u, '#fff6dc');
  ctx.save();
  ctx.translate(w * 0.4, 0);
  twinkles(ctx, rnd, w * 0.6, h * 0.03, h * 0.34, 4, u, '#fff6dc');
  ctx.restore();

  // crescent moon
  const mx = w * 0.22;
  const my = h * 0.13;
  const mr = 5.6 * u;
  glow(ctx, mx, my, mr * 6, '#cfd8ff', 0.34);
  ctx.fillStyle = '#fff8dc';
  ctx.beginPath();
  ctx.arc(mx, my, mr, Math.PI * 0.32, Math.PI * 1.68, false);
  ctx.arc(mx + mr * 0.52, my, mr * 0.84, Math.PI * 1.58, Math.PI * 0.42, true);
  ctx.closePath();
  ctx.fill();

  // soft clouds low in the afterglow
  for (let i = 0; i < 5; i++) {
    const cy = h * (0.56 + rnd() * 0.14);
    cloudBar(ctx, rnd() * w, cy, (22 + rnd() * 36) * u, (0.8 + rnd() * 1.1) * u, cy > h * 0.64 ? 'rgba(255,236,214,0.5)' : 'rgba(255,190,226,0.3)');
  }
  glow(ctx, w * 0.5, ground, 62 * u, '#ffe0b8', 0.5);

  // far wings of the palace, hazy in the distance
  const farWall = '#8a86e4';
  ctx.fillStyle = farWall;
  const farDomes = [0.08, 5, 0.3, 7, 0.7, 7, 0.92, 5];
  ctx.fillRect(0, ground - 9 * u, w, 12 * u);
  for (let i = 0; i < farDomes.length; i += 2) {
    const fx = w * farDomes[i];
    const fs = farDomes[i + 1] * u;
    ctx.fillStyle = farWall;
    ctx.fillRect(fx - fs * 1.1, ground - 9 * u - fs * 0.9, fs * 2.2, fs);
    ctx.fillStyle = '#7fc8e0';
    ctx.beginPath();
    onionDome(ctx, fx, ground - 9 * u - fs * 0.85, fs, fs * 1.25);
    ctx.fill();
  }
  tower(ctx, w * 0.19, ground, 31 * u, 3 * u, '#7672dc', '#6fc0de');
  tower(ctx, w * 0.81, ground, 31 * u, 3 * u, '#7672dc', '#6fc0de');

  // main palace
  const cx = w * 0.5;
  const drumW = 15 * u;
  const drumTop = ground - 22 * u;
  const wall = lGrad(ctx, cx - 30 * u, 0, cx + 30 * u, 0, [
    [0, '#5a58cc'],
    [0.45, '#4442b0'],
    [1, '#33329a'],
  ]);
  ctx.fillStyle = wall;
  ctx.fillRect(cx - 24 * u, ground - 14 * u, 48 * u, 15 * u);
  ctx.fillRect(cx - drumW, drumTop, drumW * 2, 9 * u);
  const sideDomes = [-0.6, 0.6];
  for (let i = 0; i < 2; i++) {
    const sx = cx + sideDomes[i] * 30 * u;
    ctx.fillStyle = wall;
    ctx.fillRect(sx - 6 * u, ground - 19 * u, 12 * u, 6 * u);
    ctx.fillStyle = domeGlaze(ctx, sx, 6 * u);
    ctx.beginPath();
    onionDome(ctx, sx, ground - 18.8 * u, 6 * u, 8 * u);
    ctx.fill();
  }
  // the great dome
  ctx.fillStyle = domeGlaze(ctx, cx, drumW);
  ctx.beginPath();
  onionDome(ctx, cx, drumTop + 0.3 * u, drumW * 1.02, 19 * u);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  onionDome(ctx, cx, drumTop + 0.3 * u, drumW * 1.02, 19 * u);
  ctx.clip();
  // ribs
  ctx.strokeStyle = 'rgba(255,246,210,0.4)';
  ctx.lineWidth = Math.max(1, 0.24 * u);
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    ctx.beginPath();
    ctx.moveTo(cx + i * drumW * 0.36, drumTop);
    ctx.quadraticCurveTo(cx + i * drumW * 0.62, drumTop - 10 * u, cx, drumTop - 21.5 * u);
    ctx.stroke();
  }
  // shade gathering under the swell
  ctx.fillStyle = lGrad(ctx, 0, drumTop - 8 * u, 0, drumTop + u, [
    [0, 'rgba(12,40,90,0)'],
    [1, 'rgba(12,40,90,0.4)'],
  ]);
  ctx.fillRect(cx - drumW * 1.4, drumTop - 8 * u, drumW * 2.8, 9 * u);
  ctx.restore();

  const towerWall = lGrad(ctx, 0, ground - 50 * u, 0, ground, [
    [0, '#4a48b8'],
    [1, '#33329a'],
  ]);
  tower(ctx, w * 0.07, ground + u, 44 * u, 4.4 * u, towerWall, domeGlaze(ctx, w * 0.07, 2.4 * u));
  tower(ctx, w * 0.93, ground + u, 44 * u, 4.4 * u, towerWall, domeGlaze(ctx, w * 0.93, 2.4 * u));
  // curtain wall with crenellations
  const wallTop = ground - 5.5 * u;
  ctx.fillStyle = '#2b2a8a';
  ctx.fillRect(0, wallTop, w, h - wallTop);
  const nb = Math.round(w / (3.2 * u));
  for (let i = 0; i < nb; i += 2) ctx.fillRect((i / nb) * w, wallTop - 1.5 * u, w / nb, 1.6 * u);

  const gold = '#ffd76a';
  finial(ctx, cx, drumTop - 21.6 * u, 1.9 * u, gold);
  finial(ctx, cx - 18 * u, ground - 27.9 * u, 1.05 * u, gold);
  finial(ctx, cx + 18 * u, ground - 27.9 * u, 1.05 * u, gold);
  finial(ctx, w * 0.07, ground - 54.3 * u, 1.05 * u, gold);
  finial(ctx, w * 0.93, ground - 54.3 * u, 1.05 * u, gold);
  // lit slits in the towers
  ctx.fillStyle = 'rgba(255,220,130,0.95)';
  for (let i = 0; i < 2; i++) {
    const tx = i === 0 ? w * 0.07 : w * 0.93;
    for (let k = 0; k < 3; k++) ctx.fillRect(tx - 0.35 * u, ground - (36 - k * 11) * u, 0.7 * u, 2.4 * u);
  }
  // gold bands on the drum and the façade
  ctx.fillStyle = 'rgba(255,215,106,0.85)';
  ctx.fillRect(cx - drumW, drumTop + 0.6 * u, drumW * 2, 0.5 * u);
  ctx.fillRect(cx - 24 * u, ground - 13.6 * u, 48 * u, 0.45 * u);

  // lit windows and the great gate
  const warm = '#ffdc82';
  for (let i = 0; i < 7; i++) {
    const wx = cx - drumW * 0.78 + (i / 6) * drumW * 1.56;
    ctx.fillStyle = rgba(warm, 0.95);
    ctx.beginPath();
    archPath(ctx, wx, drumTop + 7.4 * u, 0.8 * u, 4.4 * u);
    ctx.fill();
  }
  for (let i = 0; i < 8; i++) {
    if (i === 3 || i === 4) continue;
    const wx = cx - 21 * u + (i / 7) * 42 * u;
    glow(ctx, wx, ground - 9 * u, 4 * u, warm, 0.3);
    ctx.fillStyle = rgba(warm, 0.96);
    ctx.beginPath();
    archPath(ctx, wx, ground - 6.6 * u, 1.3 * u, 5.4 * u);
    ctx.fill();
  }
  glow(ctx, cx, ground - 3 * u, 16 * u, warm, 0.55);
  ctx.fillStyle = lGrad(ctx, 0, ground - 11 * u, 0, ground + 2 * u, [
    [0, '#fff6d6'],
    [1, '#ffc060'],
  ]);
  ctx.beginPath();
  archPath(ctx, cx, ground + 2 * u, 4.6 * u, 13.5 * u);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,106,0.9)';
  ctx.lineWidth = Math.max(1, 0.4 * u);
  ctx.stroke();

  // gardens: path of light, cypress trees
  fillV(ctx, w, ground + 2 * u, h, [
    [0, '#24348c'],
    [1, '#121c56'],
  ]);
  ctx.fillStyle = lGrad(ctx, 0, ground + 2 * u, 0, h, [
    [0, 'rgba(255,210,130,0.62)'],
    [1, 'rgba(255,210,130,0.04)'],
  ]);
  ctx.beginPath();
  ctx.moveTo(cx - 4.6 * u, ground + 2 * u);
  ctx.lineTo(cx + 4.6 * u, ground + 2 * u);
  ctx.lineTo(cx + 20 * u, h);
  ctx.lineTo(cx - 20 * u, h);
  ctx.closePath();
  ctx.fill();
  // lamps along the path, growing as they come towards us
  for (let i = 0; i < 5; i++) {
    const t = (i + 0.6) / 5;
    const ly = ground + 2 * u + t * t * (h - ground - 2 * u) * 0.92;
    const spread = 4.6 * u + (15.4 * u * (ly - ground - 2 * u)) / Math.max(1, h - ground - 2 * u);
    const r = (0.35 + t * 0.75) * u;
    for (let side = -1; side <= 1; side += 2) {
      const lx = cx + side * (spread + r * 2);
      glow(ctx, lx, ly, r * 7, '#ffd27a', 0.46);
      ctx.fillStyle = '#fff6d6';
      ctx.beginPath();
      ctx.arc(lx, ly, r, 0, TAU);
      ctx.fill();
    }
  }
  const trees = [0.04, 15, 0.14, 21, 0.25, 13, 0.75, 13, 0.86, 21, 0.96, 15];
  for (let i = 0; i < trees.length; i += 2) {
    const tx = w * trees[i] + (rnd() - 0.5) * u;
    const th = trees[i + 1] * u;
    const by = h - (h - ground) * 0.12 * (i % 4 === 2 ? 0.2 : 1);
    ctx.fillStyle = lGrad(ctx, tx - th * 0.2, 0, tx + th * 0.2, 0, [
      [0, '#1c6a72'],
      [0.5, '#12495c'],
      [1, '#0d3048'],
    ]);
    ctx.beginPath();
    ctx.moveTo(tx, by - th);
    ctx.bezierCurveTo(tx + th * 0.2, by - th * 0.6, tx + th * 0.2, by - th * 0.15, tx + th * 0.06, by);
    ctx.lineTo(tx - th * 0.06, by);
    ctx.bezierCurveTo(tx - th * 0.2, by - th * 0.15, tx - th * 0.2, by - th * 0.6, tx, by - th);
    ctx.fill();
    ctx.fillStyle = '#0d3048';
    ctx.fillRect(tx - th * 0.02, by - u, th * 0.04, h - by + u);
  }
  ctx.fillStyle = '#0d2a48';
  ctx.fillRect(0, h - (h - ground) * 0.1, w * 0.3, (h - ground) * 0.1 + 1);
  ctx.fillRect(w * 0.7, h - (h - ground) * 0.1, w * 0.3, (h - ground) * 0.1 + 1);
}

// ───────────────────────────── caverns ─────────────────────────────

function crystal(ctx: Ctx, x: number, y: number, len: number, wd: number, ang: number, light: string, mid: string, dark: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const sh = len * 0.8;
  // left face
  ctx.fillStyle = lGrad(ctx, 0, -len, 0, 0, [
    [0, light],
    [1, mid],
  ]);
  ctx.beginPath();
  ctx.moveTo(-wd, 0);
  ctx.lineTo(-wd, -sh);
  ctx.lineTo(0, -len);
  ctx.lineTo(-wd * 0.18, -sh * 0.96);
  ctx.lineTo(-wd * 0.18, 0);
  ctx.closePath();
  ctx.fill();
  // right face
  ctx.fillStyle = lGrad(ctx, 0, -len, 0, 0, [
    [0, mid],
    [1, dark],
  ]);
  ctx.beginPath();
  ctx.moveTo(-wd * 0.18, 0);
  ctx.lineTo(-wd * 0.18, -sh * 0.96);
  ctx.lineTo(0, -len);
  ctx.lineTo(wd, -sh);
  ctx.lineTo(wd, 0);
  ctx.closePath();
  ctx.fill();
  // lit edge
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = Math.max(1, wd * 0.09);
  ctx.beginPath();
  ctx.moveTo(-wd * 0.18, 0);
  ctx.lineTo(-wd * 0.18, -sh * 0.96);
  ctx.lineTo(0, -len);
  ctx.stroke();
  ctx.restore();
}

function crystalCluster(ctx: Ctx, rnd: Rnd, x: number, y: number, s: number, dir: number, hue: number): void {
  const sets: [string, string, string][] = [
    ['#d6fffa', '#3fe0d0', '#0e7f86'],
    ['#eaffff', '#7fe8ff', '#1f7fb4'],
    ['#f1deff', '#b05cff', '#4a1b9a'],
  ];
  const c = sets[hue % sets.length];
  glow(ctx, x, y - Math.cos(dir) * s * 0.5, s * 2.3, c[1], 0.34);
  const n = 5;
  const order = [0, 4, 1, 3, 2];
  for (let k = 0; k < n; k++) {
    const i = order[k];
    const a = dir + (i - 2) * 0.36 + (rnd() - 0.5) * 0.14;
    const len = s * (i === 2 ? 1 : 0.5 + rnd() * 0.32);
    // bases spread across the cluster's own width, whatever way it points
    crystal(ctx, x + Math.cos(dir) * (i - 2) * s * 0.14, y + Math.sin(dir) * (i - 2) * s * 0.14, len, len * (0.13 + rnd() * 0.04), a, c[0], c[1], c[2]);
  }
}

/** Jagged rock curtain hanging from `y` (dir = 1) or rising from it (dir = -1). */
function rockTeeth(ctx: Ctx, rnd: Rnd, w: number, edge: number, y: number, dir: number, u: number, count: number, lenMin: number, lenMax: number): void {
  ctx.beginPath();
  ctx.moveTo(-2, edge);
  ctx.lineTo(-2, y);
  const step = w / count;
  let x = 0;
  for (let i = 0; i < count; i++) {
    const cxp = x + step * (0.3 + rnd() * 0.4);
    const len = (lenMin + rnd() * rnd() * (lenMax - lenMin)) * u;
    const nx = x + step;
    const wob = (rnd() - 0.5) * 2 * u;
    ctx.quadraticCurveTo(x + step * 0.22, y + dir * len * 0.2, cxp, y + dir * len);
    ctx.quadraticCurveTo(nx - step * 0.2, y + dir * len * 0.22, nx, y + dir * wob);
    x = nx;
  }
  ctx.lineTo(w + 2, y);
  ctx.lineTo(w + 2, edge);
  ctx.closePath();
  ctx.fill();
}

function caverns(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  const u = Math.min(w, h) / 100;
  ctx.fillStyle = '#0a1438';
  ctx.fillRect(0, 0, w, h);
  const gx = w * 0.5;
  const gy = h * 0.6;
  const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.72);
  g.addColorStop(0, '#46e0c6');
  g.addColorStop(0.2, '#1fa9a6');
  g.addColorStop(0.48, '#14688a');
  g.addColorStop(0.8, '#0f2f60');
  g.addColorStop(1, '#0a1438');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // shafts of light from above
  for (let i = 0; i < 4; i++) {
    const x0 = w * (0.18 + i * 0.2 + rnd() * 0.08);
    const sw = (5 + rnd() * 7) * u;
    const lean = (10 + rnd() * 12) * u;
    const sg = ctx.createLinearGradient(0, 0, 0, h * 0.8);
    sg.addColorStop(0, 'rgba(190,255,250,0.13)');
    sg.addColorStop(1, 'rgba(190,255,250,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x0 + sw, 0);
    ctx.lineTo(x0 + sw * 2.2 - lean, h * 0.8);
    ctx.lineTo(x0 - sw * 1.2 - lean, h * 0.8);
    ctx.closePath();
    ctx.fill();
  }

  // far rock
  ctx.fillStyle = '#17567c';
  rockTeeth(ctx, rnd, w, 0, h * 0.07, 1, u, 11, 4, 22);
  ctx.fillStyle = '#154e70';
  rockTeeth(ctx, rnd, w, h, h * 0.86, -1, u, 9, 3, 17);
  for (let i = 0; i < 5; i++) {
    const x = w * (0.12 + i * 0.19 + rnd() * 0.06);
    crystalCluster(ctx, rnd, x, h * (0.86 + rnd() * 0.02), (6 + rnd() * 4) * u, (rnd() - 0.5) * 0.5, i);
  }

  // glowing pool
  const py = h * 0.9;
  glow(ctx, gx, py, 44 * u, '#5ff0e0', 0.3);
  ctx.fillStyle = lGrad(ctx, 0, py - 4 * u, 0, py + 6 * u, [
    [0, 'rgba(120,255,240,0.55)'],
    [1, 'rgba(30,150,170,0.25)'],
  ]);
  ctx.beginPath();
  ctx.ellipse(gx, py + u, Math.min(w * 0.42, 46 * u), 4.6 * u, 0, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = 'rgba(220,255,250,' + (0.2 + rnd() * 0.4).toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(gx + (rnd() - 0.5) * Math.min(w * 0.6, 70 * u), py + (rnd() - 0.2) * 4 * u, (2 + rnd() * 5) * u, 0.22 * u, 0, 0, TAU);
    ctx.fill();
  }

  // near rock: walls, ceiling, floor
  const near = '#0b1d44';
  ctx.fillStyle = near;
  rockTeeth(ctx, rnd, w, 0, h * 0.025, 1, u, 7, 5, 30);
  rockTeeth(ctx, rnd, w, h, h * 0.955, -1, u, 6, 3, 15);
  // side walls
  for (let side = 0; side < 2; side++) {
    const dir = side === 0 ? 1 : -1;
    const ex = side === 0 ? 0 : w;
    ctx.beginPath();
    ctx.moveTo(ex, 0);
    let y = 0;
    const n = 9;
    for (let i = 0; i < n; i++) {
      const ny = ((i + 1) / n) * h;
      const depth = (3 + rnd() * 9) * u * (1 + 0.8 * Math.abs(i - 4) / 4);
      ctx.quadraticCurveTo(ex + dir * depth, y + (ny - y) * 0.3, ex + dir * depth * 0.55, (y + ny) / 2);
      ctx.quadraticCurveTo(ex + dir * depth * 0.2, y + (ny - y) * 0.85, ex + dir * (1 + rnd() * 3) * u, ny);
      y = ny;
    }
    ctx.lineTo(ex, h);
    ctx.closePath();
    ctx.fill();
  }
  // foreground crystals
  crystalCluster(ctx, rnd, w * 0.1, h * 0.965, 17 * u, 0.3, 0);
  crystalCluster(ctx, rnd, w * 0.9, h * 0.97, 15 * u, -0.34, 2);
  crystalCluster(ctx, rnd, -0.5 * u, h * 0.36, 12 * u, 1.25, 1);
  crystalCluster(ctx, rnd, w + 0.5 * u, h * 0.47, 13 * u, -1.2, 0);
  crystalCluster(ctx, rnd, w * 0.3, h * 0.006, 13 * u, Math.PI - 0.15, 2);
  crystalCluster(ctx, rnd, w * 0.74, h * 0.008, 15 * u, Math.PI + 0.2, 1);

  // drifting motes
  for (let i = 0; i < 80; i++) {
    const x = rnd() * w;
    const y = h * (0.1 + rnd() * 0.82);
    const r = (0.12 + rnd() * 0.3) * u;
    if (rnd() < 0.3) glow(ctx, x, y, r * 7, '#9ffff0', 0.3);
    ctx.fillStyle = 'rgba(210,255,250,' + (0.25 + rnd() * 0.6).toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
}

// ───────────────────────────── stars ─────────────────────────────

// Constellations drawn from the game's own world: lamp, jewel, arch, palm. [points], [edges]
const CONSTELLATIONS: readonly [readonly number[], readonly number[]][] = [
  [
    [1, 0.3, 0.76, 0.5, 0.46, 0.78, 0.14, 0.5, 0.46, 0.26, 0, 0.36, 1.02, 0.02],
    [0, 1, 1, 2, 2, 3, 3, 4, 4, 1, 3, 5],
  ],
  [
    [0.5, 0, 0.92, 0.4, 0.5, 1, 0.08, 0.4, 0.5, 0.4],
    [0, 1, 1, 2, 2, 3, 3, 0, 3, 4, 4, 1, 0, 4, 4, 2],
  ],
  [
    [0, 1, 0, 0.46, 0.2, 0.16, 0.5, 0, 0.8, 0.16, 1, 0.46, 1, 1],
    [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6],
  ],
  [
    [0.5, 1, 0.44, 0.6, 0.5, 0.3, 0.08, 0.22, 0.2, 0.5, 0.9, 0.2, 0.82, 0.52, 0.5, 0],
    [0, 1, 1, 2, 2, 3, 2, 4, 2, 5, 2, 6, 2, 7],
  ],
];

function constellation(ctx: Ctx, idx: number, x: number, y: number, s: number, u: number): void {
  const def = CONSTELLATIONS[idx % CONSTELLATIONS.length];
  const p = def[0];
  const e = def[1];
  ctx.strokeStyle = 'rgba(255,231,163,0.4)';
  ctx.lineWidth = Math.max(1, 0.2 * u);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < e.length; i += 2) {
    ctx.moveTo(x + p[e[i] * 2] * s, y + p[e[i] * 2 + 1] * s);
    ctx.lineTo(x + p[e[i + 1] * 2] * s, y + p[e[i + 1] * 2 + 1] * s);
  }
  ctx.stroke();
  for (let i = 0; i < p.length; i += 2) {
    const px = x + p[i] * s;
    const py = y + p[i + 1] * s;
    const r = (i === 0 ? 1.7 : 1.15) * u;
    glow(ctx, px, py, r * 3.4, '#ffe7a3', 0.42);
    ctx.fillStyle = '#fff8dc';
    ctx.beginPath();
    khatam(ctx, px, py, r, -Math.PI / 2);
    ctx.fill();
  }
}

function stars(ctx: Ctx, w: number, h: number, rnd: Rnd): void {
  const u = Math.min(w, h) / 100;
  fillV(ctx, w, 0, h, [
    [0, '#070620'],
    [0.5, '#15104a'],
    [1, '#2a1a68'],
  ]);
  // a river of nebula light across the sky
  const cols = ['#6a3fd0', '#b0409a', '#2f6fe0', '#3fc0d0'];
  for (let i = 0; i < 30; i++) {
    const t = i / 29;
    const px = -0.1 * w + t * 1.2 * w + (rnd() - 0.5) * 16 * u;
    const py = h * (0.74 - t * 0.5) + (rnd() - 0.5) * 22 * u;
    glow(ctx, px, py, (20 + rnd() * 26) * u, cols[i % cols.length], 0.1 + rnd() * 0.1);
  }
  starField(ctx, rnd, w, 0, h, 560, u, '#ffffff');
  starField(ctx, rnd, w, 0, h, 90, u * 1.5, '#cfe0ff');
  twinkles(ctx, rnd, w, 0, h * 0.94, 18, u, '#ffffff');

  // astrolabe rings: faint khatam rosette
  const rx = w * 0.5;
  const ry = h * 0.4;
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = 'rgba(255,231,163,0.085)';
  ctx.lineWidth = Math.max(1, 0.22 * u);
  const rr = Math.min(w * 0.46, 44 * u);
  ctx.beginPath();
  khatam(ctx, rx, ry, rr, -Math.PI / 2);
  khatam(ctx, rx, ry, rr * 0.7, -Math.PI / 2 + Math.PI / 8);
  khatam(ctx, rx, ry, rr * 0.42, -Math.PI / 2);
  ctx.moveTo(rx + rr * 1.06, ry);
  ctx.arc(rx, ry, rr * 1.06, 0, TAU);
  ctx.stroke();

  const s = Math.min(w * 0.3, 30 * u);
  constellation(ctx, 0, w * 0.1, h * 0.08, s, u);
  constellation(ctx, 1, w * 0.68, h * 0.19, s * 0.72, u);
  constellation(ctx, 2, w * 0.1, h * 0.6, s * 0.86, u);
  constellation(ctx, 3, w * 0.62, h * 0.7, s * 0.9, u);

  // shooting star
  const sx = w * 0.84;
  const sy = h * 0.075;
  const tail = ctx.createLinearGradient(sx, sy, sx - 24 * u, sy + 9 * u);
  tail.addColorStop(0, 'rgba(255,255,255,0.95)');
  tail.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.strokeStyle = tail;
  ctx.lineWidth = Math.max(1, 0.34 * u);
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx - 24 * u, sy + 9 * u);
  ctx.stroke();
  glow(ctx, sx, sy, 3 * u, '#ffffff', 0.7);

  // sleeping dunes at the very bottom
  const d1 = ridge(rnd, w, h * 0.955, 2.2 * u, 1.2);
  ridgePath(ctx, d1, w, h + 2);
  ctx.fillStyle = '#120d3c';
  ctx.fill();
  ridgeLine(ctx, d1, w);
  ctx.strokeStyle = 'rgba(170,160,255,0.3)';
  ctx.lineWidth = Math.max(1, 0.22 * u);
  ctx.stroke();
  const d2 = ridge(rnd, w, h * 0.985, 1.8 * u, 1.7);
  ridgePath(ctx, d2, w, h + 2);
  ctx.fillStyle = '#0a0828';
  ctx.fill();
}

const PAINTERS: Record<ChapterTheme, (ctx: Ctx, w: number, h: number, rnd: Rnd) => void> = {
  oasis,
  dunes,
  bazaar,
  palace,
  caverns,
  stars,
};

/** The scene alone, without the opaque safety fill (the gallery uses this to find uncovered pixels). */
export function paintScene(ctx: Ctx, theme: ChapterTheme, w: number, h: number): void {
  const paint = PAINTERS[theme] || PAINTERS.oasis;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  paint(ctx, w, h, mulberry32(hashStr('backdrop:' + theme)));
  ctx.restore();
}

export function paintBackdrop(ctx: Ctx, theme: ChapterTheme, w: number, h: number): void {
  // safety net: whatever a scene might leave uncovered is sky-coloured, never transparent
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = (PALETTES[theme] || PALETTES.oasis).bgTop;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  paintScene(ctx, theme, w, h);
}
